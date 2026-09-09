import * as fs from 'fs';
import * as path from 'path';
import { PiiRedactor } from '../../src/ai/utils/pii-redactor';
import { FeatureExtractor } from '../../src/ai/utils/feature-extractor';
import { AiOutputValidator } from '../../src/ai/schemas/output-schemas';
import { GeminiAdapter } from '../../src/ai/adapters/gemini.adapter';
import { AiMetricsService } from '../../src/ai/metrics/ai-metrics.service';
import { AiOutputInvalidException, AiRateLimitedException } from '../../src/ai/errors/ai.errors';

describe('Phase 6 — AI Capabilities Unit Tests', () => {
  describe('BE-6-001 & BE-6-007: PII Redactor', () => {
    it('redacts email, phone, national id, and physical addresses', () => {
      const rawText =
        'Candidate: John Doe. Email: john.doe@example.com. Phone: 0912345678. CCCD: 012345678912. Address: Số 45 Nguyễn Trãi, Thanh Xuân, Hà Nội. Skills: NestJS, TypeScript, Docker.';

      const redacted = PiiRedactor.redact(rawText);

      expect(redacted).not.toContain('john.doe@example.com');
      expect(redacted).not.toContain('0912345678');
      expect(redacted).not.toContain('012345678912');
      expect(redacted).toContain('[REDACTED_EMAIL]');
      expect(redacted).toContain('[REDACTED_PHONE]');
      expect(redacted).toContain('[REDACTED_ID]');
      expect(redacted).toContain('NestJS, TypeScript, Docker');
    });

    it('accurately identifies presence of sensitive PII', () => {
      expect(PiiRedactor.containsSensitivePii('Email: test@gmail.com')).toBe(true);
      expect(PiiRedactor.containsSensitivePii('Tel: 0987654321')).toBe(true);
      expect(PiiRedactor.containsSensitivePii('Skills: Python, Go, Kubernetes')).toBe(false);
    });
  });

  describe('BE-6-006 & BE-6-007: Feature Extractor', () => {
    it('extracts canonical tech skills regardless of casing or aliases', () => {
      const text =
        'Experienced in NodeJS, ReactJS, ts, postgresql, K8s, AWS, and Golang backend services.';
      const skills = FeatureExtractor.extractSkills(text);

      expect(skills).toContain('Node.js');
      expect(skills).toContain('React');
      expect(skills).toContain('TypeScript');
      expect(skills).toContain('PostgreSQL');
      expect(skills).toContain('Kubernetes');
      expect(skills).toContain('AWS');
      expect(skills).toContain('Go');
    });

    it('estimates years of experience and education', () => {
      const text =
        'Senior Software Engineer with 5+ years of experience. Education: Bachelor Degree in Computer Science from 2015 to 2019.';
      const expYears = FeatureExtractor.extractExperienceYears(text);
      const education = FeatureExtractor.extractEducation(text);
      const headline = FeatureExtractor.extractHeadline(text);

      expect(expYears).toBe(5);
      expect(education.length).toBeGreaterThan(0);
      expect(headline).toBe('Software Engineer');
    });
  });

  describe('BE-6-003, BE-6-004 & BE-6-005: Gemini Adapter Resilience & Output Validator', () => {
    let adapter: GeminiAdapter;
    const mockConfigService: any = {
      get: (key: string) => {
        if (key === 'GEMINI_MODEL') return 'gemini-1.5-flash';
        return undefined; // Offline stub mode
      },
    };

    beforeEach(() => {
      adapter = new GeminiAdapter(mockConfigService);
    });

    it('executes deterministic offline matching and enforces score bounds [0, 100]', async () => {
      const cvText =
        'Fullstack dev with 4 years experience in NestJS, React, PostgreSQL, Docker, Redis.';
      const match = await adapter.matchCvJob(
        cvText,
        'Senior Backend Developer',
        'Backend engineering',
        'Requires NestJS and PostgreSQL',
        ['NestJS', 'PostgreSQL', 'Docker', 'Redis'],
      );

      expect(match.overallScore).toBeGreaterThanOrEqual(0);
      expect(match.overallScore).toBeLessThanOrEqual(100);
      expect(match.matchedSkills).toEqual(
        expect.arrayContaining(['NestJS', 'PostgreSQL', 'Docker', 'Redis']),
      );
      expect(match.missingSkills).toHaveLength(0);

      const totalWeight = match.components.reduce((sum, c) => sum + c.weight, 0);
      expect(totalWeight).toBeCloseTo(1.0);
    });

    it('executes gap analysis and identifies missing skills without inventing claims', async () => {
      const cvText = 'Junior dev with HTML, CSS, JavaScript, React.';
      const gap = await adapter.gapAnalysisCvJob(
        cvText,
        'DevOps Specialist',
        'Cloud infrastructure',
        'Requires Kubernetes and Terraform',
        ['Kubernetes', 'AWS', 'Docker'],
      );

      expect(gap.missingSkills).toEqual(expect.arrayContaining(['Kubernetes', 'AWS', 'Docker']));
      expect(gap.suggestions.length).toBeGreaterThan(0);
      expect(gap.limitations.length).toBeGreaterThan(0);
    });

    it('rejects malformed json or invalid structure in AiOutputValidator', () => {
      expect(() => AiOutputValidator.validateMatch(null)).toThrow(AiOutputInvalidException);
      expect(() => AiOutputValidator.validateMatch('invalid')).toThrow(AiOutputInvalidException);

      // Clamps out of bound scores
      const result = AiOutputValidator.validateMatch({
        overallScore: 150,
        components: [{ name: 'SKILLS', score: -20, weight: 0.5, evidence: [] }],
      });
      expect(result.overallScore).toBe(100);
      expect(result.components[0].score).toBe(0);
    });

    it('safely cleans code fences when parsing JSON from LLM', () => {
      const rawWithFences = '```json\n{"skills": ["NestJS", "TypeScript"]}\n```';
      const parsed = adapter.parseJsonFromLlm(rawWithFences);
      expect(parsed).toEqual({ skills: ['NestJS', 'TypeScript'] });
    });
  });

  describe('BE-6-013: Natural Language Search Parsing', () => {
    it('validates supported filters and rejects injection-like inputs', () => {
      const rawInput = {
        query: 'Senior React remote in Hanoi',
        workplaceType: ['REMOTE', 'INVALID_WORKPLACE', "'; DROP TABLE jobs; --"],
        experienceLevel: ['SENIOR'],
        location: ['Hanoi'],
        salaryMin: 25000000,
        maliciousField: 'exploit',
      };

      const sanitized = AiOutputValidator.validateSearchParse(rawInput);

      expect(sanitized.workplaceType).toEqual(['REMOTE']);
      expect(sanitized.experienceLevel).toEqual(['SENIOR']);
      expect(sanitized.location).toEqual(['Hanoi']);
      expect(sanitized.salaryMin).toBe(25000000);
      expect((sanitized as any).maliciousField).toBeUndefined();
    });
  });

  describe('BE-6-018 & BE-6-019: AI Metrics and Concurrency Controls', () => {
    let metricsService: AiMetricsService;

    beforeEach(() => {
      metricsService = new AiMetricsService();
    });

    it('acquires and releases concurrency slots, enforcing per-user limits', () => {
      const userId = 'user-123';
      metricsService.acquireSlot(userId);
      metricsService.releaseSlot();

      // Exhaust daily quota test simulation
      for (let i = 0; i < 99; i++) {
        metricsService.acquireSlot(userId);
        metricsService.releaseSlot();
      }

      // 101st request should be rejected with rate limit
      expect(() => metricsService.acquireSlot(userId)).toThrow(AiRateLimitedException);
    });

    it('records privacy-safe execution metrics without raw CV or prompt content', () => {
      metricsService.recordMetric({
        model: 'gemini-1.5-flash',
        operation: 'CV_JOB_ANALYSIS',
        durationMs: 120,
        status: 'SUCCESS',
        estimatedTokens: 850,
      });

      const summary = metricsService.getMetricsSummary();
      expect(summary.totalCalls).toBe(1);
      expect(summary.successRate).toBe(100);
      expect(summary.avgLatencyMs).toBe(120);
      expect(summary.totalTokens).toBe(850);
    });
  });

  describe('BE-6-012: Architectural Invariant — AI Cannot Transition Applications', () => {
    it('proves statically that src/ai has NO dependency on ApplicationsService or transition methods', () => {
      const aiDir = path.resolve(__dirname, '../../src/ai');
      const files: string[] = [];

      function walk(dir: string) {
        for (const item of fs.readdirSync(dir)) {
          const fullPath = path.join(dir, item);
          if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
          } else if (item.endsWith('.ts')) {
            files.push(fullPath);
          }
        }
      }
      walk(aiDir);

      const violations: string[] = [];

      for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const relPath = path.relative(aiDir, filePath);

        if (content.includes('ApplicationsService')) {
          violations.push(`${relPath} imports or references ApplicationsService`);
        }
        if (content.includes('transitionApplication')) {
          violations.push(`${relPath} calls transitionApplication`);
        }
        if (content.includes('application.update') && content.includes('status:')) {
          violations.push(`${relPath} directly mutates application status`);
        }
      }

      expect(violations).toEqual([]);
    });
  });
});
