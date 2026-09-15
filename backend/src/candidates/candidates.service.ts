import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { CandidateProfile, CandidateSkill, Skill, WorkExperience } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CompletenessService } from './completeness.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { ERROR_CODES } from '../common/constants/error-codes';
import {
  CandidateProfileDto,
  UpdateCandidateProfileDto,
  UploadCandidateAvatarResponseDto,
} from './dto/candidate.dto';

export interface UploadedAvatarFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class CandidatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly completenessService: CompletenessService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
  ) {}

  async getProfile(userId: string): Promise<CandidateProfileDto> {
    const profile = await this.prisma.candidateProfile.findUnique({
      where: { userId },
      include: {
        skills: {
          include: { skill: true },
        },
        experiences: {
          orderBy: { startDate: 'desc' },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Candidate profile not found.',
      });
    }

    return this.mapToDto(profile);
  }

  async updateProfile(
    userId: string,
    dto: UpdateCandidateProfileDto,
  ): Promise<CandidateProfileDto> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.candidateProfile.findUnique({
        where: { userId },
        include: {
          skills: true,
          experiences: true,
        },
      });

      if (!existing) {
        throw new NotFoundException({
          code: ERROR_CODES.RESOURCE_NOT_FOUND,
          message: 'Candidate profile not found.',
        });
      }

      if (existing.version !== dto.expectedVersion) {
        throw new ConflictException({
          code: ERROR_CODES.VERSION_CONFLICT,
          message: 'Candidate profile was modified by another request. Stale version.',
        });
      }

      // 1. Validate skills before destructive replacement
      if (dto.skills !== undefined) {
        const skillIds = dto.skills.map((s) => s.skillId);
        const uniqueSkillIds = new Set(skillIds);
        if (uniqueSkillIds.size !== skillIds.length) {
          throw new BadRequestException({
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Duplicate skillId provided in skills list.',
          });
        }

        if (skillIds.length > 0) {
          const activeSkills = await tx.skill.findMany({
            where: {
              id: { in: skillIds },
              active: true,
            },
          });

          if (activeSkills.length !== skillIds.length) {
            throw new BadRequestException({
              code: ERROR_CODES.VALIDATION_ERROR,
              message:
                'One or more skill IDs are invalid, inactive, or not found in canonical catalog.',
            });
          }
        }
      }

      // 2. Validate experiences before destructive replacement
      if (dto.experiences !== undefined) {
        for (const exp of dto.experiences) {
          if (exp.endDate && new Date(exp.startDate) > new Date(exp.endDate)) {
            throw new BadRequestException({
              code: ERROR_CODES.VALIDATION_ERROR,
              message: 'startDate cannot be after endDate in work experiences.',
            });
          }
        }
      }

      // 3. Destructive replacement of skills
      if (dto.skills !== undefined) {
        await tx.candidateSkill.deleteMany({
          where: { candidateProfileId: existing.id },
        });

        for (const s of dto.skills) {
          await tx.candidateSkill.create({
            data: {
              candidateProfileId: existing.id,
              skillId: s.skillId,
              yearsOfExperience: s.yearsOfExperience,
            },
          });
        }
      }

      // 4. Destructive replacement of experiences
      if (dto.experiences !== undefined) {
        await tx.workExperience.deleteMany({
          where: { candidateProfileId: existing.id },
        });

        for (const exp of dto.experiences) {
          await tx.workExperience.create({
            data: {
              id: exp.id,
              candidateProfileId: existing.id,
              companyName: exp.companyName,
              title: exp.title,
              startDate: new Date(exp.startDate),
              endDate: exp.endDate ? new Date(exp.endDate) : null,
              description: exp.description ?? null,
            },
          });
        }
      }

      // 5. Update scalar fields
      const newFullName = dto.fullName !== undefined ? dto.fullName : existing.fullName;
      const newHeadline = dto.headline !== undefined ? dto.headline : existing.headline;
      const newPhone = dto.phone !== undefined ? dto.phone : existing.phone;
      const newLocation = dto.location !== undefined ? dto.location : existing.location;
      const newBio = dto.bio !== undefined ? dto.bio : existing.bio;

      // Recalculate completeness
      const currentSkillsCount =
        dto.skills !== undefined ? dto.skills.length : existing.skills.length;
      const currentExperiencesCount =
        dto.experiences !== undefined ? dto.experiences.length : existing.experiences.length;

      const newCompleteness = this.completenessService.calculate({
        fullName: newFullName,
        headline: newHeadline,
        phone: newPhone,
        location: newLocation,
        bio: newBio,
        skillsCount: currentSkillsCount,
        experiencesCount: currentExperiencesCount,
      });

      const updated = await tx.candidateProfile.update({
        where: { id: existing.id },
        data: {
          fullName: newFullName,
          headline: newHeadline,
          phone: newPhone,
          location: newLocation,
          bio: newBio,
          isSearchable: dto.isSearchable !== undefined ? dto.isSearchable : existing.isSearchable,
          profileCompleteness: newCompleteness,
          version: existing.version + 1,
        },
        include: {
          skills: {
            include: { skill: true },
          },
          experiences: {
            orderBy: { startDate: 'desc' },
          },
        },
      });

      return this.mapToDto(updated);
    });
  }

  async uploadAvatar(
    userId: string,
    file: UploadedAvatarFile,
    options?: { expectedVersion?: number },
  ): Promise<UploadCandidateAvatarResponseDto> {
    const profile = await this.prisma.candidateProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Candidate profile not found.',
      });
    }

    if (options?.expectedVersion !== undefined && profile.version !== options.expectedVersion) {
      throw new ConflictException({
        code: ERROR_CODES.VERSION_CONFLICT,
        message: 'Candidate profile was modified by another request. Stale version.',
      });
    }

    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Avatar file is required in multipart field "avatar".',
      });
    }

    const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_AVATAR_SIZE || file.buffer.length > MAX_AVATAR_SIZE) {
      throw new PayloadTooLargeException({
        code: ERROR_CODES.FILE_TOO_LARGE,
        message: 'File size exceeds the 5 MiB limit.',
      });
    }

    const allowedMimes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new UnsupportedMediaTypeException({
        code: ERROR_CODES.INVALID_FILE_TYPE,
        message: 'Only PNG, JPEG, and WebP images are supported.',
      });
    }

    let detectedExt: string | null = null;
    const buf = file.buffer;

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    ) {
      detectedExt = 'png';
    } else if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      detectedExt = 'jpg';
    } else if (
      buf.length >= 12 &&
      buf[0] === 0x52 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x46 &&
      buf[8] === 0x57 &&
      buf[9] === 0x45 &&
      buf[10] === 0x42 &&
      buf[11] === 0x50
    ) {
      detectedExt = 'webp';
    }

    if (!detectedExt) {
      throw new UnsupportedMediaTypeException({
        code: ERROR_CODES.INVALID_FILE_TYPE,
        message: 'Invalid image signature.',
      });
    }

    const mimeExtMap: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
    };

    if (mimeExtMap[file.mimetype] !== detectedExt) {
      throw new UnsupportedMediaTypeException({
        code: ERROR_CODES.INVALID_FILE_TYPE,
        message: 'MIME type does not match image file signature.',
      });
    }

    const assetKey = `candidates/${profile.id}/${uuidv4()}.${detectedExt}`;
    const publicUrl = await this.storageService.uploadPublicAsset(
      assetKey,
      file.buffer,
      file.mimetype,
    );

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const res = await tx.candidateProfile.update({
          where: { id: profile.id, version: profile.version },
          data: {
            avatarUrl: publicUrl,
            version: profile.version + 1,
          },
        });

        await this.auditService.record(
          {
            actorId: userId,
            action: 'CANDIDATE_AVATAR_UPDATED',
            targetType: 'CandidateProfile',
            targetId: profile.id,
            metadata: { version: res.version },
          },
          tx,
        );

        return res;
      });

      if (profile.avatarUrl && this.isManagedAssetUrl(profile.avatarUrl, profile.id)) {
        const oldKey = this.extractAssetKey(profile.avatarUrl);
        if (oldKey) {
          await this.storageService.deletePublicAsset(oldKey).catch(() => {});
        }
      }

      return {
        avatarUrl: updated.avatarUrl!,
        version: updated.version,
      };
    } catch (err) {
      await this.storageService.deletePublicAsset(assetKey).catch(() => {});
      throw err;
    }
  }

  private isManagedAssetUrl(url: string, profileId: string): boolean {
    return (
      url.includes(`/candidates/${profileId}/`) &&
      (url.includes('itziec-assets') || url.includes(this.storageService.getAssetsBucket()))
    );
  }

  private extractAssetKey(url: string): string | null {
    const match = url.match(/candidates\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-.]+/);
    return match ? match[0] : null;
  }

  private mapToDto(
    profile: CandidateProfile & {
      skills?: (CandidateSkill & { skill?: Skill | null })[];
      experiences?: WorkExperience[];
    },
  ): CandidateProfileDto {
    return {
      id: profile.id,
      userId: profile.userId,
      fullName: profile.fullName,
      headline: profile.headline,
      phone: profile.phone,
      location: profile.location,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl || null,
      isSearchable: profile.isSearchable,
      profileCompleteness: profile.profileCompleteness,
      skills: (profile.skills || []).map((s) => ({
        skillId: s.skillId,
        name: s.skill?.name || s.skillId,
        yearsOfExperience: s.yearsOfExperience,
      })),
      experiences: (profile.experiences || []).map((e) => ({
        id: e.id,
        companyName: e.companyName,
        title: e.title,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate ? e.endDate.toISOString() : null,
        description: e.description,
      })),
      defaultCvId: profile.defaultCvId,
      version: profile.version,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }
}
