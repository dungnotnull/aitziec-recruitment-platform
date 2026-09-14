import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CandidateProfile, CandidateSkill, Skill, WorkExperience } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CompletenessService } from './completeness.service';
import { ERROR_CODES } from '../common/constants/error-codes';
import { CandidateProfileDto, UpdateCandidateProfileDto } from './dto/candidate.dto';

@Injectable()
export class CandidatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly completenessService: CompletenessService,
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
          if (exp.endDate) {
            const start = new Date(exp.startDate).getTime();
            const end = new Date(exp.endDate).getTime();
            if (end < start) {
              throw new BadRequestException({
                code: ERROR_CODES.VALIDATION_ERROR,
                message: `Experience endDate (${exp.endDate}) cannot be earlier than startDate (${exp.startDate}).`,
              });
            }
          }
        }
      }

      // 3. Handle skills replacement
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

      // Handle experiences replacement
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

      const skillsCount = dto.skills !== undefined ? dto.skills.length : existing.skills.length;
      const experiencesCount =
        dto.experiences !== undefined ? dto.experiences.length : existing.experiences.length;

      const newFullName = dto.fullName !== undefined ? dto.fullName : existing.fullName;
      const newHeadline = dto.headline !== undefined ? dto.headline : existing.headline;
      const newPhone = dto.phone !== undefined ? dto.phone : existing.phone;
      const newLocation = dto.location !== undefined ? dto.location : existing.location;
      const newBio = dto.bio !== undefined ? dto.bio : existing.bio;

      const newCompleteness = this.completenessService.calculate({
        fullName: newFullName,
        headline: newHeadline,
        phone: newPhone,
        location: newLocation,
        bio: newBio,
        skillsCount,
        experiencesCount,
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
