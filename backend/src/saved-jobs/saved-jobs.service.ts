import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { ERROR_CODES } from '../common/constants/error-codes';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto, CollectionResponse } from '../common/dto/response.dto';
import { JobDto } from '../jobs/dto/job.dto';
import { SavedJobCheckDto } from './dto/saved-job-check.dto';

@Injectable()
export class SavedJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
  ) {}

  private async getCandidateProfileId(userId: string): Promise<string> {
    const profile = await this.prisma.candidateProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Candidate profile required to save jobs.',
      });
    }
    return profile.id;
  }

  /**
   * Kiểm tra trạng thái ứng viên đã lưu công việc hay chưa (BE-9-003, API-SAVE-004).
   * Truy vấn chỉ đọc, dùng composite unique key candidateProfileId_jobId.
   */
  async checkSavedJob(jobId: string, user: AuthenticatedUser): Promise<SavedJobCheckDto> {
    const candidateProfileId = await this.getCandidateProfileId(user.id);

    const savedJob = await this.prisma.savedJob.findUnique({
      where: {
        candidateProfileId_jobId: {
          candidateProfileId,
          jobId,
        },
      },
      select: { id: true },
    });

    return { isSaved: savedJob !== null };
  }

  async saveJob(jobId: string, user: AuthenticatedUser): Promise<void> {
    const candidateProfileId = await this.getCandidateProfileId(user.id);

    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { company: true },
    });

    if (!job) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Job not found.',
      });
    }

    const existing = await this.prisma.savedJob.findUnique({
      where: {
        candidateProfileId_jobId: {
          candidateProfileId,
          jobId,
        },
      },
    });

    if (existing) {
      return; // Idempotent: already saved
    }

    await this.prisma.savedJob.create({
      data: {
        candidateProfileId,
        jobId,
      },
    });
  }

  async unsaveJob(jobId: string, user: AuthenticatedUser): Promise<void> {
    const candidateProfileId = await this.getCandidateProfileId(user.id);

    await this.prisma.savedJob.deleteMany({
      where: {
        candidateProfileId,
        jobId,
      },
    });
  }

  async listSavedJobs(
    user: AuthenticatedUser,
    query: PaginationQueryDto,
  ): Promise<CollectionResponse<JobDto>> {
    const candidateProfileId = await this.getCandidateProfileId(user.id);
    const limit = query.limit ?? 20;

    const savedJobs = await this.prisma.savedJob.findMany({
      where: { candidateProfileId },
      include: {
        job: {
          include: { company: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...(query.cursor && {
        cursor: { id: query.cursor },
        skip: 1,
      }),
      take: limit + 1,
    });

    const hasMore = savedJobs.length > limit;
    const items = hasMore ? savedJobs.slice(0, limit) : savedJobs;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

    const mappedJobs: JobDto[] = items
      .filter((s: any) => s.job)
      .map((s: any) => this.jobsService.mapToDto(s.job));

    return {
      data: mappedJobs,
      meta: {
        page: {
          nextCursor,
          hasNextPage: hasMore,
          limit,
        },
      } as any,
    };
  }
}
