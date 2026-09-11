import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Buffer } from 'node:buffer';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ERROR_CODES } from '../common/constants/error-codes';
import { AI_PROVIDER_PORT, IAiProviderPort } from './interfaces/ai-provider.port';
import { CvNotReadyException } from './errors/ai.errors';
import { CreateCvJobAnalysisDto } from './dto/create-analysis.dto';
import { AiAnalysisDto, ScoreComponentDto } from './dto/ai-analysis.dto';
import { OperationDto } from './dto/operation.dto';
import { RecommendationQueryDto } from './dto/recommendation.dto';
import {
  RecommendationPreferenceDto,
  UpdateRecommendationPreferenceDto,
} from './dto/recommendation-preference.dto';
import { CollectionResponse } from '../common/dto/response.dto';
import { JobDto } from '../jobs/dto/job.dto';
import { JobsService } from '../jobs/jobs.service';
import { AiMetricsService } from './metrics/ai-metrics.service';

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly jobsService: JobsService,
    private readonly metricsService: AiMetricsService,
    @Inject(AI_PROVIDER_PORT) private readonly aiProvider: IAiProviderPort,
  ) {}

  /**
   * Request an asynchronous CV-Job evaluation (BE-6-008, BE-6-011).
   * Advisory only: does NOT modify application status (BE-6-012).
   */
  async createCvJobAnalysis(
    user: AuthenticatedUser,
    dto: CreateCvJobAnalysisDto,
    requestId?: string,
    idempotencyKey?: string,
  ): Promise<OperationDto> {
    // 1. Check idempotency if key provided
    if (idempotencyKey) {
      const existingOp = await this.prisma.operation.findFirst({
        where: { userId: user.id, idempotencyKey },
      });
      if (existingOp) {
        return this.mapOperationToDto(existingOp);
      }
    }

    // 2. Fetch CV and verify readiness
    const cv = await this.prisma.cv.findUnique({
      where: { id: dto.cvId },
      include: { candidateProfile: true },
    });

    if (!cv || cv.processingStatus === 'DELETED') {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'CV not found.',
      });
    }

    if (cv.processingStatus !== 'READY') {
      throw new CvNotReadyException();
    }

    // 3. Fetch Job
    const job = await this.prisma.job.findUnique({
      where: { id: dto.jobId },
      include: { company: true },
    });

    if (!job) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Job not found.',
      });
    }

    // 4. Authorization Matrix (BE-6-010)
    await this.authorizeAnalysisCreation(user, cv, job);

    // 5. Create Operation record
    const operation = await this.prisma.operation.create({
      data: {
        userId: user.id,
        type: 'CV_JOB_ANALYSIS',
        status: 'PROCESSING',
        progressPercent: 25,
        idempotencyKey,
      },
    });

    this.metricsService.acquireSlot(user.id);
    const startTime = Date.now();

    try {
      const cvText = cv.extractedText || '';
      const matchResult = await this.aiProvider.matchCvJob(
        cvText,
        job.title,
        job.description,
        job.requirements,
        job.technologyNames || [],
      );

      let gapResult: any = null;
      if (dto.analyses.includes('CV_GAP_ANALYSIS')) {
        gapResult = await this.aiProvider.gapAnalysisCvJob(
          cvText,
          job.title,
          job.description,
          job.requirements,
          job.technologyNames || [],
        );
      }

      // Determine analysis primary type
      let analysisType: 'CV_JOB_MATCH' | 'CV_GAP_ANALYSIS' | 'CV_JOB_ANALYSIS' = 'CV_JOB_ANALYSIS';
      if (dto.analyses.length === 1) {
        analysisType = dto.analyses[0];
      }

      const createdAnalysis = await this.prisma.aiAnalysis.create({
        data: {
          type: analysisType,
          candidateId: cv.candidateProfileId,
          cvId: cv.id,
          jobId: job.id,
          status: 'SUCCEEDED',
          overallScore: matchResult.overallScore,
          components: matchResult.components as any,
          matchedSkills: matchResult.matchedSkills,
          missingSkills: gapResult ? gapResult.missingSkills : matchResult.missingSkills,
          unmetRequirements: gapResult ? gapResult.unmetRequirements : [],
          suggestions: gapResult ? gapResult.suggestions : [],
          limitations: gapResult ? gapResult.limitations : [],
          model: matchResult.model,
          promptVersion: matchResult.promptVersion,
          schemaVersion: matchResult.schemaVersion,
        },
      });

      // Update operation as completed
      const updatedOp = await this.prisma.operation.update({
        where: { id: operation.id },
        data: {
          status: 'SUCCEEDED',
          progressPercent: 100,
          resultResourceType: 'AI_ANALYSIS',
          resultResourceId: createdAnalysis.id,
          completedAt: new Date(),
        },
      });

      this.metricsService.recordMetric({
        model: matchResult.model,
        operation: 'CV_JOB_ANALYSIS',
        durationMs: Date.now() - startTime,
        status: 'SUCCESS',
        estimatedTokens: Math.round(cvText.length / 4) + 500,
      });

      await this.auditService.record({
        actorId: user.id,
        action: 'AI_ANALYSIS_COMPLETED',
        targetType: 'AiAnalysis',
        targetId: createdAnalysis.id,
        requestId,
        metadata: {
          cvId: cv.id,
          jobId: job.id,
          overallScore: createdAnalysis.overallScore,
        },
      });

      return this.mapOperationToDto(updatedOp);
    } catch (err: any) {
      this.metricsService.recordMetric({
        model: 'unknown',
        operation: 'CV_JOB_ANALYSIS',
        durationMs: Date.now() - startTime,
        status: 'FAILURE',
        estimatedTokens: 0,
      });

      const failedOp = await this.prisma.operation.update({
        where: { id: operation.id },
        data: {
          status: 'FAILED',
          progressPercent: 100,
          failureCode: err.response?.code || 'AI_PROCESSING_FAILED',
          failureMessage: err.message || 'AI processing encountered an error',
          completedAt: new Date(),
        },
      });

      return this.mapOperationToDto(failedOp);
    } finally {
      this.metricsService.releaseSlot();
    }
  }

  /**
   * Get AI Analysis Detail with Scoped Authorization (BE-6-010, BE-6-011).
   */
  async getAnalysisDetail(user: AuthenticatedUser, analysisId: string): Promise<AiAnalysisDto> {
    const analysis = await this.prisma.aiAnalysis.findUnique({
      where: { id: analysisId },
      include: {
        candidate: true,
        cv: true,
        job: true,
      },
    });

    if (!analysis) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'AI Analysis not found.',
      });
    }

    await this.authorizeAnalysisRead(user, analysis);

    return this.mapAnalysisToDto(analysis);
  }

  /**
   * Get Asynchronous Operation Status (BE-6-011).
   */
  async getOperationDetail(user: AuthenticatedUser, operationId: string): Promise<OperationDto> {
    const op = await this.prisma.operation.findUnique({
      where: { id: operationId },
    });

    if (!op) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Operation not found.',
      });
    }

    if (user.role !== 'ADMIN' && op.userId !== user.id) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'You do not have permission to view this operation.',
      });
    }

    return this.mapOperationToDto(op);
  }

  /**
   * Giải mã con trỏ phân trang nghiêm ngặt (BE-9-004).
   * Bắt mọi ngoại lệ và quăng BadRequestException(INVALID_CURSOR) với thông báo tiếng Việt.
   */
  private decodeCursor(cursor: string): { score: number; jobId: string } {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf8');
      const parts = decoded.split(':');
      if (parts.length !== 2) {
        throw new BadRequestException({
          code: ERROR_CODES.INVALID_CURSOR,
          message: 'Định dạng con trỏ phân trang không hợp lệ.',
        });
      }
      const score = parseInt(parts[0], 10);
      const jobId = parts[1];
      if (isNaN(score) || score < 0 || score > 100 || !jobId || jobId.trim().length === 0) {
        throw new BadRequestException({
          code: ERROR_CODES.INVALID_CURSOR,
          message: 'Dữ liệu con trỏ phân trang không hợp lệ.',
        });
      }
      return { score, jobId };
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException({
        code: ERROR_CODES.INVALID_CURSOR,
        message: 'Định dạng con trỏ phân trang không hợp lệ.',
      });
    }
  }

  /**
   * Mã hóa con trỏ phân trang an toàn (BE-9-004).
   */
  private encodeCursor(score: number, jobId: string): string {
    return Buffer.from(`${score}:${jobId}`).toString('base64');
  }

  /**
   * Gợi ý việc làm giải thích được dành cho ứng viên (BE-6-015, BE-6-016, BE-6-017, BE-8-022, BE-9-004).
   */
  async getJobRecommendations(
    user: AuthenticatedUser,
    query: RecommendationQueryDto,
  ): Promise<CollectionResponse<JobDto>> {
    const limit = query.limit ?? 20;

    // 0. Kiểm tra tùy chọn gợi ý / trạng thái từ chối của ứng viên (BE-8-021)
    const preference = await this.prisma.recommendationPreference.findUnique({
      where: { userId: user.id },
    });
    if (preference && !preference.enabled) {
      return {
        data: [],
        meta: {
          optedOut: true,
          message: 'Candidate has disabled automated job recommendations.',
          page: {
            nextCursor: null,
            hasNextPage: false,
            limit,
          },
        } as any,
      };
    }

    const candidateProfile = await this.prisma.candidateProfile.findUnique({
      where: { userId: user.id },
      include: {
        skills: { include: { skill: true } },
      },
    });

    if (!candidateProfile) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Candidate profile not found.',
      });
    }

    // 1. Loại trừ các công việc ứng viên đã nộp hồ sơ
    const existingApplications = await this.prisma.application.findMany({
      where: { candidateId: candidateProfile.id },
      select: { jobId: true },
    });
    const appliedJobIds = new Set(existingApplications.map((a: any) => a.jobId));

    // 2. Truy vấn các công việc PUBLISHED thuộc các công ty ACTIVE (BE-8-022)
    const publishedJobs = await this.prisma.job.findMany({
      where: {
        status: 'PUBLISHED',
        applicationDeadline: { gt: new Date() },
        company: { status: 'ACTIVE' },
      },
      include: { company: true },
    });

    // 3. Lọc bỏ các công việc đã nộp hoặc công ty không ACTIVE
    const eligibleJobs = publishedJobs.filter((j: any) => {
      if (appliedJobIds.has(j.id)) return false;
      if (j.company && j.company.status !== 'ACTIVE') return false;
      return true;
    });

    // 4. Tập hợp kỹ năng của ứng viên
    const candidateSkills = new Set<string>();
    if (candidateProfile.skills) {
      for (const cs of candidateProfile.skills) {
        if (cs.skill?.name) candidateSkills.add(cs.skill.name.toLowerCase());
      }
    }

    // 5. Tính điểm công việc với cơ chế phòng thủ dữ liệu null-safe (BE-8-022, BE-9-004)
    const scoredJobs = eligibleJobs.map((job: any) => {
      let score = 50; // Điểm cơ bản cho công việc hợp lệ
      const reasonCodes: string[] = ['ACTIVE_ELIGIBLE_JOB'];
      const evidence: string[] = ['Job is currently published and open for applications'];

      const jobTechs = Array.isArray(job.technologyNames) ? job.technologyNames : [];
      const matchedSkillsList: string[] = [];
      if (jobTechs.length > 0) {
        let matchedCount = 0;
        for (const tech of jobTechs) {
          if (typeof tech === 'string' && candidateSkills.has(tech.toLowerCase())) {
            matchedCount++;
            matchedSkillsList.push(tech);
          }
        }
        const skillOverlapRatio = matchedCount / jobTechs.length;
        score += Math.round(skillOverlapRatio * 40);
        if (matchedCount > 0) {
          reasonCodes.push('SKILL_MATCH');
          evidence.push(`Matched ${matchedCount} skill(s): ${matchedSkillsList.join(', ')}`);
        }
      }

      // Đối chiếu tiêu đề với headline (an toàn khi headline/title null hoặc không phải string)
      if (
        candidateProfile.headline &&
        typeof job.title === 'string' &&
        job.title.toLowerCase().includes(candidateProfile.headline.toLowerCase())
      ) {
        score += 10;
        reasonCodes.push('HEADLINE_MATCH');
        evidence.push(`Job title matches candidate headline: ${candidateProfile.headline}`);
      }

      score = Math.min(100, Math.max(0, score));

      const limitations = [
        'AI generated recommendations do not guarantee interview invitation',
        'Recommendation match is evaluated based on profile skills and advertised job requirements',
      ];

      return { job, score, reasonCodes, evidence, limitations };
    });

    // 6. Sắp xếp đơn định theo score desc, publishedAt desc, id (an toàn khi null)
    scoredJobs.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const dateA = new Date(a.job?.publishedAt || a.job?.createdAt || 0).getTime();
      const dateB = new Date(b.job?.publishedAt || b.job?.createdAt || 0).getTime();
      if (dateB !== dateA) return dateB - dateA;
      const idA = a.job?.id || '';
      const idB = b.job?.id || '';
      return idA.localeCompare(idB);
    });

    // 7. Phân trang con trỏ nghiêm ngặt (BE-8-022, BE-9-004)
    let startIndex = 0;

    if (query.cursor) {
      const { score: cursorScore, jobId: cursorId } = this.decodeCursor(query.cursor);
      const foundIdx = scoredJobs.findIndex(
        (item) => item.score === cursorScore && item.job?.id === cursorId,
      );
      if (foundIdx !== -1) {
        startIndex = foundIdx + 1;
      } else {
        throw new BadRequestException({
          code: ERROR_CODES.INVALID_CURSOR,
          message: 'Con trỏ phân trang đã hết hạn hoặc không tồn tại trong tập kết quả.',
        });
      }
    }

    const pageItems = scoredJobs.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < scoredJobs.length;

    let nextCursor: string | null = null;
    if (hasMore && pageItems.length > 0) {
      const lastItem = pageItems[pageItems.length - 1];
      if (lastItem?.job?.id) {
        nextCursor = this.encodeCursor(lastItem.score, lastItem.job.id);
      }
    }

    return {
      data: pageItems.map((item) => {
        const jobDto = this.jobsService.mapToDto(item.job);
        return {
          ...jobDto,
          job: jobDto,
          score: item.score,
          reasonCodes: item.reasonCodes,
          evidence: item.evidence,
          limitations: item.limitations,
        };
      }) as any,
      meta: {
        page: {
          nextCursor,
          hasNextPage: hasMore,
          limit,
        },
      } as any,
    };
  }

  /**
   * Recommendation Preferences and Consent (BE-8-021).
   */
  async getRecommendationPreferences(
    user: AuthenticatedUser,
  ): Promise<RecommendationPreferenceDto> {
    let pref = await this.prisma.recommendationPreference.findUnique({
      where: { userId: user.id },
    });

    if (!pref) {
      pref = await this.prisma.recommendationPreference.create({
        data: {
          userId: user.id,
          enabled: true,
          consentPolicyVersion: 'v1.0',
          version: 1,
        },
      });
    }

    return this.mapPreferenceToDto(pref);
  }

  async updateRecommendationPreferences(
    user: AuthenticatedUser,
    dto: UpdateRecommendationPreferenceDto,
    requestId?: string,
  ): Promise<RecommendationPreferenceDto> {
    let current = await this.prisma.recommendationPreference.findUnique({
      where: { userId: user.id },
    });

    if (!current) {
      current = await this.prisma.recommendationPreference.create({
        data: {
          userId: user.id,
          enabled: true,
          consentPolicyVersion: 'v1.0',
          version: 1,
        },
      });
    }

    if (current.version !== dto.expectedVersion) {
      throw new ConflictException({
        code: ERROR_CODES.VERSION_CONFLICT,
        message: `Version conflict: current version is ${current.version}, expected ${dto.expectedVersion}.`,
      });
    }

    const updated = await this.prisma.recommendationPreference.update({
      where: { userId: user.id },
      data: {
        enabled: dto.enabled,
        consentPolicyVersion: dto.consentPolicyVersion || current.consentPolicyVersion,
        consentedAt: new Date(),
        version: { increment: 1 },
      },
    });

    await this.auditService.record({
      actorId: user.id,
      action: 'RECOMMENDATION_PREFERENCE_UPDATED',
      targetType: 'USER',
      targetId: user.id,
      requestId,
      metadata: {
        enabled: updated.enabled,
        consentPolicyVersion: updated.consentPolicyVersion,
        version: updated.version,
      },
    });

    return this.mapPreferenceToDto(updated);
  }

  private mapPreferenceToDto(pref: any): RecommendationPreferenceDto {
    return {
      id: pref.id,
      userId: pref.userId,
      enabled: pref.enabled,
      consentPolicyVersion: pref.consentPolicyVersion,
      consentedAt: new Date(pref.consentedAt).toISOString(),
      version: pref.version,
      createdAt: new Date(pref.createdAt).toISOString(),
      updatedAt: new Date(pref.updatedAt).toISOString(),
    };
  }

  // --- AUTHORIZATION HELPERS ---

  private async authorizeAnalysisCreation(
    user: AuthenticatedUser,
    cv: any,
    job: any,
  ): Promise<void> {
    if (user.role === 'ADMIN') return;

    if (user.role === 'CANDIDATE') {
      if (cv.candidateProfile?.userId !== user.id) {
        throw new ForbiddenException({
          code: ERROR_CODES.FORBIDDEN,
          message: 'You can only run analysis on your own CV.',
        });
      }
      return;
    }

    if (user.role === 'HR') {
      // Must belong to the company that posted the job
      const membership = await this.prisma.companyMembership.findFirst({
        where: {
          companyId: job.companyId,
          userId: user.id,
        },
      });
      if (!membership) {
        throw new ForbiddenException({
          code: ERROR_CODES.FORBIDDEN,
          message: 'You can only analyze CVs for jobs in your company.',
        });
      }
      return;
    }

    throw new ForbiddenException({
      code: ERROR_CODES.FORBIDDEN,
      message: 'Not authorized to request AI analysis.',
    });
  }

  private async authorizeAnalysisRead(user: AuthenticatedUser, analysis: any): Promise<void> {
    if (user.role === 'ADMIN') return;

    if (user.role === 'CANDIDATE') {
      if (analysis.candidate?.userId !== user.id) {
        throw new ForbiddenException({
          code: ERROR_CODES.FORBIDDEN,
          message: 'You can only view AI analyses of your own profile.',
        });
      }
      return;
    }

    if (user.role === 'HR') {
      if (analysis.job?.companyId) {
        const membership = await this.prisma.companyMembership.findFirst({
          where: {
            companyId: analysis.job.companyId,
            userId: user.id,
          },
        });
        if (membership) return;
      }
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'You do not have access to this analysis.',
      });
    }

    throw new ForbiddenException({
      code: ERROR_CODES.FORBIDDEN,
      message: 'Forbidden.',
    });
  }

  // --- DTO MAPPERS ---

  public mapOperationToDto(op: any): OperationDto {
    return {
      id: op.id,
      type: op.type,
      status: op.status,
      progressPercent: op.progressPercent ?? null,
      resultResource: op.resultResourceType
        ? { type: op.resultResourceType, id: op.resultResourceId }
        : null,
      failure: op.failureCode ? { code: op.failureCode, message: op.failureMessage || '' } : null,
      createdAt: op.createdAt.toISOString(),
      updatedAt: op.updatedAt.toISOString(),
      completedAt: op.completedAt ? op.completedAt.toISOString() : null,
    };
  }

  public mapAnalysisToDto(analysis: any): AiAnalysisDto {
    const rawComponents = Array.isArray(analysis.components)
      ? analysis.components
      : typeof analysis.components === 'string'
        ? JSON.parse(analysis.components)
        : [];

    const components: ScoreComponentDto[] = rawComponents.map((c: any) => ({
      name: c.name,
      score: c.score,
      weight: c.weight,
      evidence: c.evidence || [],
    }));

    return {
      id: analysis.id,
      type: analysis.type,
      candidateId: analysis.candidateId,
      cvId: analysis.cvId,
      jobId: analysis.jobId ?? null,
      status: analysis.status,
      overallScore: analysis.overallScore ?? null,
      components,
      matchedSkills: analysis.matchedSkills || [],
      missingSkills: analysis.missingSkills || [],
      unmetRequirements: analysis.unmetRequirements || [],
      suggestions: analysis.suggestions || [],
      limitations: analysis.limitations || [],
      model: analysis.model,
      promptVersion: analysis.promptVersion,
      schemaVersion: analysis.schemaVersion,
      createdAt: analysis.createdAt.toISOString(),
    };
  }
}
