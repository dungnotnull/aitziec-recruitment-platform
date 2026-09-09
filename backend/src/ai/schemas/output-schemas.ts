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
  static validateExtraction(data: any): CvProfileExtractionResult {
    if (!data || typeof data !== 'object') {
      throw new AiOutputInvalidException('Extraction output is not an object.');
    }

    const skills = Array.isArray(data.skills)
      ? data.skills.filter((s: any) => typeof s === 'string')
      : [];
    const education = Array.isArray(data.education)
      ? data.education.filter((e: any) => typeof e === 'string')
      : [];
    const experienceYears =
      typeof data.experienceYears === 'number' &&
      data.experienceYears >= 0 &&
      data.experienceYears <= 50
        ? data.experienceYears
        : null;
    const headline = typeof data.headline === 'string' ? data.headline.slice(0, 200) : null;
    const summary = typeof data.summary === 'string' ? data.summary.slice(0, 1000) : null;

    return { skills, experienceYears, headline, education, summary };
  }

  /**
   * Validates CV/JD match evaluation result.
   */
  static validateMatch(data: any): CvJobMatchResult {
    if (!data || typeof data !== 'object') {
      throw new AiOutputInvalidException('Match output is not an object.');
    }

    let overallScore = typeof data.overallScore === 'number' ? Math.round(data.overallScore) : 0;
    overallScore = Math.max(0, Math.min(100, overallScore));

    const allowedNames = ['SKILLS', 'EXPERIENCE', 'REQUIREMENTS', 'KEYWORDS'];
    const components = Array.isArray(data.components)
      ? data.components
          .filter((c: any) => c && allowedNames.includes(c.name))
          .map((c: any) => ({
            name: c.name as 'SKILLS' | 'EXPERIENCE' | 'REQUIREMENTS' | 'KEYWORDS',
            score: Math.max(
              0,
              Math.min(100, typeof c.score === 'number' ? Math.round(c.score) : 50),
            ),
            weight:
              typeof c.weight === 'number' && c.weight >= 0 && c.weight <= 1 ? c.weight : 0.25,
            evidence: Array.isArray(c.evidence)
              ? c.evidence.filter((e: any) => typeof e === 'string')
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

    const matchedSkills = Array.isArray(data.matchedSkills)
      ? data.matchedSkills.filter((s: any) => typeof s === 'string')
      : [];
    const missingSkills = Array.isArray(data.missingSkills)
      ? data.missingSkills.filter((s: any) => typeof s === 'string')
      : [];

    return {
      overallScore,
      components,
      matchedSkills,
      missingSkills,
      model: typeof data.model === 'string' ? data.model : 'gemini-1.5-flash',
      promptVersion:
        typeof data.promptVersion === 'string' ? data.promptVersion : 'cv_job_match_v1.0',
      schemaVersion: SCHEMA_VERSION,
    };
  }

  /**
   * Validates CV gap analysis result.
   */
  static validateGap(data: any): CvGapAnalysisResult {
    if (!data || typeof data !== 'object') {
      throw new AiOutputInvalidException('Gap analysis output is not an object.');
    }

    const missingSkills = Array.isArray(data.missingSkills)
      ? data.missingSkills.filter((s: any) => typeof s === 'string')
      : [];
    const unmetRequirements = Array.isArray(data.unmetRequirements)
      ? data.unmetRequirements.filter((r: any) => typeof r === 'string')
      : [];
    const suggestions = Array.isArray(data.suggestions)
      ? data.suggestions.filter((s: any) => typeof s === 'string')
      : [];
    const limitations = Array.isArray(data.limitations)
      ? data.limitations.filter((l: any) => typeof l === 'string')
      : [];

    return {
      missingSkills,
      unmetRequirements,
      suggestions,
      limitations,
      model: typeof data.model === 'string' ? data.model : 'gemini-1.5-flash',
      promptVersion: typeof data.promptVersion === 'string' ? data.promptVersion : 'cv_gap_v1.0',
      schemaVersion: SCHEMA_VERSION,
    };
  }

  /**
   * Validates natural language search parse result.
   */
  static validateSearchParse(data: any): ParsedSearchFilterResult {
    if (!data || typeof data !== 'object') {
      throw new AiOutputInvalidException('Search parse output is not an object.');
    }

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

    if (typeof data.query === 'string' && data.query.trim()) {
      result.query = data.query.trim().slice(0, 200);
    }
    if (Array.isArray(data.workplaceType)) {
      const filtered = data.workplaceType.filter((w: any) => validWorkplaceTypes.includes(w));
      if (filtered.length > 0) result.workplaceType = filtered;
    }
    if (Array.isArray(data.experienceLevel)) {
      const filtered = data.experienceLevel.filter((e: any) => validExperienceLevels.includes(e));
      if (filtered.length > 0) result.experienceLevel = filtered;
    }
    if (Array.isArray(data.employmentType)) {
      const filtered = data.employmentType.filter((e: any) => validEmploymentTypes.includes(e));
      if (filtered.length > 0) result.employmentType = filtered;
    }
    if (Array.isArray(data.location)) {
      const filtered = data.location.filter((l: any) => typeof l === 'string' && l.trim());
      if (filtered.length > 0) result.location = filtered;
    }
    if (Array.isArray(data.technologyNames)) {
      const filtered = data.technologyNames.filter((t: any) => typeof t === 'string' && t.trim());
      if (filtered.length > 0) result.technologyNames = filtered;
    }
    if (typeof data.salaryMin === 'number' && data.salaryMin >= 0) {
      result.salaryMin = Math.round(data.salaryMin);
    }
    if (typeof data.salaryMax === 'number' && data.salaryMax >= 0) {
      result.salaryMax = Math.round(data.salaryMax);
    }

    return result;
  }
}
