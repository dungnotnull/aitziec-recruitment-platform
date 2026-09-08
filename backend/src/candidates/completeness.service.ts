import { Injectable } from '@nestjs/common';

export interface ProfileCompletenessInput {
  fullName?: string | null;
  headline?: string | null;
  phone?: string | null;
  location?: string | null;
  bio?: string | null;
  skillsCount?: number;
  experiencesCount?: number;
}

@Injectable()
export class CompletenessService {
  calculate(input: ProfileCompletenessInput): number {
    let score = 0;

    if (input.fullName && input.fullName.trim().length > 0) {
      score += 15;
    }
    if (input.headline && input.headline.trim().length > 0) {
      score += 10;
    }
    if (input.phone && input.phone.trim().length > 0) {
      score += 10;
    }
    if (input.location && input.location.trim().length > 0) {
      score += 10;
    }
    if (input.bio && input.bio.trim().length > 0) {
      score += 15;
    }
    if (input.skillsCount && input.skillsCount > 0) {
      score += 20;
    }
    if (input.experiencesCount && input.experiencesCount > 0) {
      score += 20;
    }

    return Math.min(100, Math.max(0, score));
  }
}
