import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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

      // Handle skills replacement
      if (dto.skills !== undefined) {
        await tx.candidateSkill.deleteMany({
          where: { candidateProfileId: existing.id },
        });

        for (const s of dto.skills) {
          // Ensure canonical skill exists
          let skill = await tx.skill.findUnique({ where: { id: s.skillId } });
          if (!skill) {
            skill = await tx.skill.create({
              data: { id: s.skillId, name: s.skillId },
            });
          }

          await tx.candidateSkill.create({
            data: {
              candidateProfileId: existing.id,
              skillId: skill.id,
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

  private mapToDto(profile: any): CandidateProfileDto {
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
      skills: (profile.skills || []).map((s: any) => ({
        skillId: s.skillId,
        name: s.skill?.name || s.skillId,
        yearsOfExperience: s.yearsOfExperience,
      })),
      experiences: (profile.experiences || []).map((e: any) => ({
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
