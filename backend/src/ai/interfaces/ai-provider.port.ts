export interface CvProfileExtractionResult {
  skills: string[];
  experienceYears: number | null;
  headline: string | null;
  education: string[];
  summary: string | null;
}

export interface ScoreComponentResult {
  name: 'SKILLS' | 'EXPERIENCE' | 'REQUIREMENTS' | 'KEYWORDS';
  score: number; // 0 - 100
  weight: number; // 0.0 - 1.0
  evidence: string[];
}

export interface CvJobMatchResult {
  overallScore: number; // 0 - 100
  components: ScoreComponentResult[];
  matchedSkills: string[];
  missingSkills: string[];
  model: string;
  promptVersion: string;
  schemaVersion: string;
}

export interface CvGapAnalysisResult {
  missingSkills: string[];
  unmetRequirements: string[];
  suggestions: string[];
  limitations: string[];
  model: string;
  promptVersion: string;
  schemaVersion: string;
}

export interface ParsedSearchFilterResult {
  query?: string;
  workplaceType?: string[];
  experienceLevel?: string[];
  employmentType?: string[];
  location?: string[];
  technologyNames?: string[];
  salaryMin?: number;
  salaryMax?: number;
}

export interface IAiProviderPort {
  extractCvProfile(cvText: string): Promise<CvProfileExtractionResult>;
  matchCvJob(
    cvText: string,
    jobTitle: string,
    jobDescription: string,
    requirements: string,
    technologies: string[],
  ): Promise<CvJobMatchResult>;
  gapAnalysisCvJob(
    cvText: string,
    jobTitle: string,
    jobDescription: string,
    requirements: string,
    technologies: string[],
  ): Promise<CvGapAnalysisResult>;
  parseSearchQuery(naturalQuery: string): Promise<ParsedSearchFilterResult>;
}

export const AI_PROVIDER_PORT = Symbol('AI_PROVIDER_PORT');
