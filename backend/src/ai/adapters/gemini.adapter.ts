import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IAiProviderPort,
  CvProfileExtractionResult,
  CvJobMatchResult,
  CvGapAnalysisResult,
  ParsedSearchFilterResult,
} from '../interfaces/ai-provider.port';
import {
  AiOutputInvalidException,
  AiRateLimitedException,
  AiUpstreamUnavailableException,
} from '../errors/ai.errors';
import { PiiRedactor } from '../utils/pii-redactor';
import { FeatureExtractor } from '../utils/feature-extractor';
import { PROMPTS } from '../prompts/prompt-registry';
import { AiOutputValidator, SCHEMA_VERSION } from '../schemas/output-schemas';

@Injectable()
export class GeminiAdapter implements IAiProviderPort {
  private readonly logger = new Logger(GeminiAdapter.name);
  private readonly apiKey: string | undefined;
  private readonly modelName: string;
  private readonly timeoutMs: number = 8000;
  private readonly maxRetries: number = 2;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.modelName = this.configService.get<string>('GEMINI_MODEL') || 'gemini-1.5-flash';
  }

  /**
   * Extract structured profile from CV text.
   */
  async extractCvProfile(cvText: string): Promise<CvProfileExtractionResult> {
    const redactedText = PiiRedactor.redact(cvText);

    if (!this.apiKey || process.env.NODE_ENV === 'test') {
      return this.offlineExtract(redactedText);
    }

    const prompt = PROMPTS.CV_EXTRACTION.template(redactedText);
    const rawResponse = await this.callGeminiWithRetry(prompt);
    const parsed = this.parseJsonFromLlm(rawResponse);
    return AiOutputValidator.validateExtraction(parsed);
  }

  /**
   * Evaluate CV against Job Description.
   */
  async matchCvJob(
    cvText: string,
    jobTitle: string,
    jobDescription: string,
    requirements: string,
    technologies: string[],
  ): Promise<CvJobMatchResult> {
    const redactedText = PiiRedactor.redact(cvText);

    if (!this.apiKey || process.env.NODE_ENV === 'test') {
      return this.offlineMatch(redactedText, jobTitle, jobDescription, requirements, technologies);
    }

    const prompt = PROMPTS.CV_JOB_MATCH.template(
      redactedText,
      jobTitle,
      jobDescription,
      requirements,
      technologies,
    );
    const rawResponse = await this.callGeminiWithRetry(prompt);
    const parsed = this.parseJsonFromLlm(rawResponse);
    parsed.model = this.modelName;
    parsed.promptVersion = PROMPTS.CV_JOB_MATCH.version;
    return AiOutputValidator.validateMatch(parsed);
  }

  /**
   * Perform gap analysis.
   */
  async gapAnalysisCvJob(
    cvText: string,
    jobTitle: string,
    jobDescription: string,
    requirements: string,
    technologies: string[],
  ): Promise<CvGapAnalysisResult> {
    const redactedText = PiiRedactor.redact(cvText);

    if (!this.apiKey || process.env.NODE_ENV === 'test') {
      return this.offlineGap(redactedText, jobTitle, jobDescription, requirements, technologies);
    }

    const prompt = PROMPTS.CV_GAP_ANALYSIS.template(
      redactedText,
      jobTitle,
      jobDescription,
      requirements,
      technologies,
    );
    const rawResponse = await this.callGeminiWithRetry(prompt);
    const parsed = this.parseJsonFromLlm(rawResponse);
    parsed.model = this.modelName;
    parsed.promptVersion = PROMPTS.CV_GAP_ANALYSIS.version;
    return AiOutputValidator.validateGap(parsed);
  }

  /**
   * Parse natural language search query.
   */
  async parseSearchQuery(naturalQuery: string): Promise<ParsedSearchFilterResult> {
    if (!this.apiKey || process.env.NODE_ENV === 'test') {
      return this.offlineSearchParse(naturalQuery);
    }

    const prompt = PROMPTS.SEARCH_QUERY_PARSE.template(naturalQuery);
    try {
      const rawResponse = await this.callGeminiWithRetry(prompt);
      const parsed = this.parseJsonFromLlm(rawResponse);
      return AiOutputValidator.validateSearchParse(parsed);
    } catch (err) {
      this.logger.warn(`AI search parse failed, falling back to heuristic: ${err}`);
      return this.offlineSearchParse(naturalQuery);
    }
  }

  /**
   * Resilience: Handles timeout, retry with backoff, rate limiting.
   */
  public async callGeminiWithRetry(prompt: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;

    let lastError: any = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = 500 * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (response.status === 429) {
          throw new AiRateLimitedException();
        }

        if (response.status >= 500) {
          throw new AiUpstreamUnavailableException(`Provider returned ${response.status}`);
        }

        if (!response.ok) {
          const errText = await response.text();
          throw new AiUpstreamUnavailableException(`Provider error: ${errText.substring(0, 200)}`);
        }

        const data: any = await response.json();
        const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) {
          throw new AiOutputInvalidException('No text content returned from Gemini.');
        }

        return candidateText;
      } catch (err: any) {
        clearTimeout(timer);
        lastError = err;

        if (err instanceof AiRateLimitedException) {
          throw err;
        }

        if (err.name === 'AbortError') {
          lastError = new AiUpstreamUnavailableException('Gemini request timed out.');
        }

        // Only retry on transient upstream errors
        if (attempt === this.maxRetries) {
          break;
        }
      }
    }

    throw (
      lastError || new AiUpstreamUnavailableException('Failed to communicate with AI provider.')
    );
  }

  /**
   * Safely parses JSON from LLM response text (handling code blocks if present).
   */
  public parseJsonFromLlm(raw: string): any {
    try {
      let cleaned = raw.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      return JSON.parse(cleaned);
    } catch {
      throw new AiOutputInvalidException('Malformed JSON received from AI provider.');
    }
  }

  // --- DETERMINISTIC OFFLINE / TEST STUB METHODS ---

  private offlineExtract(text: string): CvProfileExtractionResult {
    const skills = FeatureExtractor.extractSkills(text);
    const experienceYears = FeatureExtractor.extractExperienceYears(text);
    const headline = FeatureExtractor.extractHeadline(text);
    const education = FeatureExtractor.extractEducation(text);
    const summary = headline ? `${headline} with practical industry experience.` : null;

    return {
      skills,
      experienceYears,
      headline,
      education,
      summary,
    };
  }

  private offlineMatch(
    cvText: string,
    jobTitle: string,
    jobDescription: string,
    requirements: string,
    technologies: string[],
  ): CvJobMatchResult {
    const cvSkills = FeatureExtractor.extractSkills(cvText);
    const cvExp = FeatureExtractor.extractExperienceYears(cvText) || 1;

    // Tech matching
    const matchedSkills = technologies.filter((tech) =>
      cvSkills.some((s) => s.toLowerCase() === tech.toLowerCase()),
    );
    const missingSkills = technologies.filter(
      (tech) => !cvSkills.some((s) => s.toLowerCase() === tech.toLowerCase()),
    );

    const skillsScore =
      technologies.length > 0 ? Math.round((matchedSkills.length / technologies.length) * 100) : 80;

    const expScore = Math.min(100, Math.round(cvExp * 20));
    const reqScore = Math.round((skillsScore + expScore) / 2);
    const kwScore = cvText.toLowerCase().includes(jobTitle.toLowerCase()) ? 90 : 70;

    const overallScore = Math.round(
      skillsScore * 0.4 + expScore * 0.3 + reqScore * 0.2 + kwScore * 0.1,
    );

    return {
      overallScore,
      components: [
        {
          name: 'SKILLS',
          score: skillsScore,
          weight: 0.4,
          evidence: matchedSkills.map((s) => `Matched skill: ${s}`),
        },
        {
          name: 'EXPERIENCE',
          score: expScore,
          weight: 0.3,
          evidence: [`Extracted ${cvExp} years of relevant experience`],
        },
        {
          name: 'REQUIREMENTS',
          score: reqScore,
          weight: 0.2,
          evidence: [`Alignment evaluated against ${requirements.slice(0, 60)}...`],
        },
        {
          name: 'KEYWORDS',
          score: kwScore,
          weight: 0.1,
          evidence: [`Job title relevance evaluated`],
        },
      ],
      matchedSkills,
      missingSkills,
      model: 'gemini-stub-v1',
      promptVersion: PROMPTS.CV_JOB_MATCH.version,
      schemaVersion: SCHEMA_VERSION,
    };
  }

  private offlineGap(
    cvText: string,
    _jobTitle: string,
    _jobDescription: string,
    _requirements: string,
    technologies: string[],
  ): CvGapAnalysisResult {
    const cvSkills = FeatureExtractor.extractSkills(cvText);
    const missingSkills = technologies.filter(
      (tech) => !cvSkills.some((s) => s.toLowerCase() === tech.toLowerCase()),
    );

    const unmetRequirements = missingSkills.map((s) => `Required technology not found in CV: ${s}`);
    const suggestions = missingSkills.map(
      (s) => `Consider adding verifiable projects or certifications demonstrating ${s}.`,
    );

    return {
      missingSkills,
      unmetRequirements,
      suggestions,
      limitations: [
        'Advisory assessment based on textual content; live interviews verify practical depth.',
      ],
      model: 'gemini-stub-v1',
      promptVersion: PROMPTS.CV_GAP_ANALYSIS.version,
      schemaVersion: SCHEMA_VERSION,
    };
  }

  private offlineSearchParse(query: string): ParsedSearchFilterResult {
    const raw = query.toLowerCase();
    const result: ParsedSearchFilterResult = { query };

    // Workplace type
    if (raw.includes('remote')) result.workplaceType = ['REMOTE'];
    else if (raw.includes('hybrid')) result.workplaceType = ['HYBRID'];
    else if (raw.includes('onsite') || raw.includes('on-site')) result.workplaceType = ['ONSITE'];

    // Experience level
    if (raw.includes('intern') || raw.includes('thực tập')) result.experienceLevel = ['INTERN'];
    else if (raw.includes('fresher')) result.experienceLevel = ['FRESHER'];
    else if (raw.includes('junior')) result.experienceLevel = ['JUNIOR'];
    else if (raw.includes('senior')) result.experienceLevel = ['SENIOR'];
    else if (raw.includes('lead')) result.experienceLevel = ['LEAD'];
    else if (raw.includes('manager') || raw.includes('quản lý'))
      result.experienceLevel = ['MANAGER'];

    // Employment type
    if (raw.includes('part-time') || raw.includes('part time'))
      result.employmentType = ['PART_TIME'];
    else if (raw.includes('contract')) result.employmentType = ['CONTRACT'];
    else if (raw.includes('full-time') || raw.includes('full time'))
      result.employmentType = ['FULL_TIME'];

    // Location
    const locs: string[] = [];
    if (raw.includes('hồ chí minh') || raw.includes('hcm') || raw.includes('saigon'))
      locs.push('Ho Chi Minh');
    if (raw.includes('hà nội') || raw.includes('hanoi')) locs.push('Hanoi');
    if (raw.includes('đà nẵng') || raw.includes('da nang')) locs.push('Da Nang');
    if (locs.length > 0) result.location = locs;

    // Technologies
    const foundTechs = FeatureExtractor.extractSkills(query);
    if (foundTechs.length > 0) result.technologyNames = foundTechs;

    return result;
  }
}
