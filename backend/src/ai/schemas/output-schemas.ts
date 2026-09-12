import { AiOutputInvalidException } from '../errors/ai.errors';
import {
  CvJobMatchResult,
  CvGapAnalysisResult,
  CvProfileExtractionResult,
  ParsedSearchFilterResult,
} from '../interfaces/ai-provider.port';

export const SCHEMA_VERSION = 'v1.0';

export class AiOutputValidator {
  /**
   * Validates structured profile extraction result.
   */
  static validateExtraction(data: unknown): CvProfileExtractionResult {
    if (!data || typeof data !== 'object') {
      throw new AiOutputInvalidException('Extraction output is not an object.');
    }

    const obj = data as Record<string, unknown>;

    const skills = Array.isArray(obj.skills)
      ? (obj.skills as unknown[]).filter((s): s is string => typeof s === 'string')
      : [];
    const education = Array.isArray(obj.education)
      ? (obj.education as unknown[]).filter((e): e is string => typeof e === 'string')
      : [];
    const experienceYears =
      typeof obj.experienceYears === 'number' &&
      obj.experienceYears >= 0 &&
      obj.experienceYears <= 50
        ? obj.experienceYears
        : null;
    const headline = typeof obj.headline === 'string' ? obj.headline.slice(0, 200) : null;
    const summary = typeof obj.summary === 'string' ? obj.summary.slice(0, 1000) : null;

    return { skills, experienceYears, headline, education, summary };
  }

  /**
   * Validates CV/JD match evaluation result.
   */
  static validateMatch(data: unknown): CvJobMatchResult {
    if (!data || typeof data !== 'object') {
      throw new AiOutputInvalidException('Match output is not an object.');
    }

    const obj = data as Record<string, unknown>;

    let overallScore = typeof obj.overallScore === 'number' ? Math.round(obj.overallScore) : 0;
    overallScore = Math.max(0, Math.min(100, overallScore));

    const allowedNames = ['SKILLS', 'EXPERIENCE', 'REQUIREMENTS', 'KEYWORDS'];
    const components = Array.isArray(obj.components)
      ? (obj.components as unknown[])
          .filter(
            (c): c is Record<string, unknown> =>
              Boolean(c) &&
              typeof c === 'object' &&
              typeof (c as Record<string, unknown>).name === 'string' &&
              allowedNames.includes((c as Record<string, unknown>).name as string),
          )
          .map((c) => ({
            name: c.name as 'SKILLS' | 'EXPERIENCE' | 'REQUIREMENTS' | 'KEYWORDS',
            score: Math.max(
              0,
              Math.min(100, typeof c.score === 'number' ? Math.round(c.score) : 50),
            ),
            weight:
              typeof c.weight === 'number' && c.weight >= 0 && c.weight <= 1 ? c.weight : 0.25,
            evidence: Array.isArray(c.evidence)
              ? (c.evidence as unknown[]).filter((e): e is string => typeof e === 'string')
              : [],
          }))
      : [];

    // Ensure we have standard components if none or incomplete
    if (components.length === 0) {
      components.push(
        { name: 'SKILLS', score: overallScore, weight: 0.4, evidence: [] },
        { name: 'EXPERIENCE', score: overallScore, weight: 0.3, evidence: [] },
        { name: 'REQUIREMENTS', score: overallScore, weight: 0.2, evidence: [] },
        { name: 'KEYWORDS', score: overallScore, weight: 0.1, evidence: [] },
      );
    }

    const matchedSkills = Array.isArray(obj.matchedSkills)
      ? (obj.matchedSkills as unknown[]).filter((s): s is string => typeof s === 'string')
      : [];
    const missingSkills = Array.isArray(obj.missingSkills)
      ? (obj.missingSkills as unknown[]).filter((s): s is string => typeof s === 'string')
      : [];

    return {
      overallScore,
      components,
      matchedSkills,
      missingSkills,
      model: typeof obj.model === 'string' ? obj.model : 'gemini-1.5-flash',
      promptVersion:
        typeof obj.promptVersion === 'string' ? obj.promptVersion : 'cv_job_match_v1.0',
      schemaVersion: SCHEMA_VERSION,
    };
  }

  /**
   * Validates CV gap analysis result.
   */
  static validateGap(data: unknown): CvGapAnalysisResult {
    if (!data || typeof data !== 'object') {
      throw new AiOutputInvalidException('Gap analysis output is not an object.');
    }

    const obj = data as Record<string, unknown>;

    const missingSkills = Array.isArray(obj.missingSkills)
      ? (obj.missingSkills as unknown[]).filter((s): s is string => typeof s === 'string')
      : [];
    const unmetRequirements = Array.isArray(obj.unmetRequirements)
      ? (obj.unmetRequirements as unknown[]).filter((r): r is string => typeof r === 'string')
      : [];
    const suggestions = Array.isArray(obj.suggestions)
      ? (obj.suggestions as unknown[]).filter((s): s is string => typeof s === 'string')
      : [];
    const limitations = Array.isArray(obj.limitations)
      ? (obj.limitations as unknown[]).filter((l): l is string => typeof l === 'string')
      : [];

    return {
      missingSkills,
      unmetRequirements,
      suggestions,
      limitations,
      model: typeof obj.model === 'string' ? obj.model : 'gemini-1.5-flash',
      promptVersion: typeof obj.promptVersion === 'string' ? obj.promptVersion : 'cv_gap_v1.0',
      schemaVersion: SCHEMA_VERSION,
    };
  }

  /**
   * Validates natural language search parse result.
   */
  static validateSearchParse(data: unknown): ParsedSearchFilterResult {
    if (!data || typeof data !== 'object') {
      throw new AiOutputInvalidException('Search parse output is not an object.');
    }

    const obj = data as Record<string, unknown>;

    const validWorkplaceTypes = ['ONSITE', 'HYBRID', 'REMOTE'];
    const validExperienceLevels = [
      'INTERN',
      'FRESHER',
      'JUNIOR',
      'MID',
      'SENIOR',
      'LEAD',
      'MANAGER',
    ];
    const validEmploymentTypes = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'];

    const result: ParsedSearchFilterResult = {};

    if (typeof obj.query === 'string' && obj.query.trim()) {
      result.query = obj.query.trim().slice(0, 200);
    }
    if (Array.isArray(obj.workplaceType)) {
      const filtered = (obj.workplaceType as unknown[]).filter(
        (w): w is string => typeof w === 'string' && validWorkplaceTypes.includes(w),
      );
      if (filtered.length > 0) result.workplaceType = filtered;
    }
    if (Array.isArray(obj.experienceLevel)) {
      const filtered = (obj.experienceLevel as unknown[]).filter(
        (e): e is string => typeof e === 'string' && validExperienceLevels.includes(e),
      );
      if (filtered.length > 0) result.experienceLevel = filtered;
    }
    if (Array.isArray(obj.employmentType)) {
      const filtered = (obj.employmentType as unknown[]).filter(
        (e): e is string => typeof e === 'string' && validEmploymentTypes.includes(e),
      );
      if (filtered.length > 0) result.employmentType = filtered;
    }
    if (Array.isArray(obj.location)) {
      const filtered = (obj.location as unknown[]).filter(
        (l): l is string => typeof l === 'string' && Boolean(l.trim()),
      );
      if (filtered.length > 0) result.location = filtered;
    }
    if (Array.isArray(obj.technologyNames)) {
      const filtered = (obj.technologyNames as unknown[]).filter(
        (t): t is string => typeof t === 'string' && Boolean(t.trim()),
      );
      if (filtered.length > 0) result.technologyNames = filtered;
    }
    if (typeof obj.salaryMin === 'number' && obj.salaryMin >= 0) {
      result.salaryMin = Math.round(obj.salaryMin);
    }
    if (typeof obj.salaryMax === 'number' && obj.salaryMax >= 0) {
      result.salaryMax = Math.round(obj.salaryMax);
    }

    return result;
  }
}
