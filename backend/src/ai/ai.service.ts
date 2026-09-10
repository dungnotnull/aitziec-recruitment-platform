import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
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
   * Explainable Job Recommendations for Candidates (BE-6-015, BE-6-016, BE-6-017).
   */
  async getJobRecommendations(
    user: AuthenticatedUser,
    query: RecommendationQueryDto,
  ): Promise<CollectionResponse<JobDto>> {
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

    // 1. Exclusion: Exclude jobs candidate has already applied to
    const existingApplications = await this.prisma.application.findMany({
      where: { candidateId: candidateProfile.id },
      select: { jobId: true },
    });
    const appliedJobIds = new Set(existingApplications.map((a: any) => a.jobId));

    // 2. Query active published jobs
    const publishedJobs = await this.prisma.job.findMany({
      where: {
        status: 'PUBLISHED',
        applicationDeadline: { gt: new Date() },
      },
      include: { company: true },
    });

    // 3. Filter out applied jobs
    const eligibleJobs = publishedJobs.filter((j: any) => !appliedJobIds.has(j.id));

    // 4. Candidate skills set
    const candidateSkills = new Set<string>();
    if (candidateProfile.skills) {
      for (const cs of candidateProfile.skills) {
        if (cs.skill?.name) candidateSkills.add(cs.skill.name.toLowerCase());
      }
    }

    // 5. Score jobs based on skill overlap & headline
    const scoredJobs = eligibleJobs.map((job: any) => {
      let score = 50; // base score for active jobs

      const jobTechs = job.technologyNames || [];
      if (jobTechs.length > 0) {
        let matchedCount = 0;
        for (const tech of jobTechs) {
          if (candidateSkills.has(tech.toLowerCase())) {
            matchedCount++;
          }
        }
        const skillOverlapRatio = matchedCount / jobTechs.length;
        score += Math.round(skillOverlapRatio * 40);
      }

      // Title relevance with headline
      if (
        candidateProfile.headline &&
        job.title.toLowerCase().includes(candidateProfile.headline.toLowerCase())
      ) {
        score += 10;
      }

      return { job, score };
    });

    // 6. Sort deterministically by score desc, then publishedAt desc, then id
    scoredJobs.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const dateA = new Date(a.job.publishedAt || a.job.createdAt).getTime();
      const dateB = new Date(b.job.publishedAt || b.job.createdAt).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return a.job.id.localeCompare(b.job.id);
    });

    // 7. Cursor pagination
    const limit = query.limit || 20;
    let startIndex = 0;

    if (query.cursor) {
      try {
        const decoded = Buffer.from(query.cursor, 'base64').toString('utf8');
        const [cursorScoreStr, cursorId] = decoded.split(':');
        const cursorScore = parseInt(cursorScoreStr, 10);

        const foundIdx = scoredJobs.findIndex(
          (item) => item.score === cursorScore && item.job.id === cursorId,
        );
        if (foundIdx !== -1) {
          startIndex = foundIdx + 1;
        }
      } catch {
        // Invalid cursor falls back to first page
      }
    }

    const pageItems = scoredJobs.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < scoredJobs.length;

    let nextCursor: string | null = null;
    if (hasMore && pageItems.length > 0) {
      const lastItem = pageItems[pageItems.length - 1];
      nextCursor = Buffer.from(`${lastItem.score}:${lastItem.job.id}`).toString('base64');
    }

    return {
      data: pageItems.map((item) => this.jobsService.mapToDto(item.job)),
      meta: {
        page: {
          nextCursor,
          hasNextPage: hasMore,
          limit,
        },
      } as any,
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
