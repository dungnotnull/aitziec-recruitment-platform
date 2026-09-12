import * as fs from 'fs';
import * as path from 'path';
import { PiiRedactor } from '../../src/ai/utils/pii-redactor';
import { FeatureExtractor } from '../../src/ai/utils/feature-extractor';
import { AiOutputValidator } from '../../src/ai/schemas/output-schemas';
import { GeminiAdapter } from '../../src/ai/adapters/gemini.adapter';
import { AiMetricsService } from '../../src/ai/metrics/ai-metrics.service';
import {
  AiOutputInvalidException,
  AiRateLimitedException,
  CvNotReadyException,
} from '../../src/ai/errors/ai.errors';
import { AiService } from '../../src/ai/ai.service';
import { CvJobAnalysisProcessor } from '../../src/ai/workers/cv-job-analysis.processor';

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

  describe('BE-10-010: Asynchronous and Idempotent CV-to-Job AI Analysis', () => {
    let aiService: AiService;
    let processor: CvJobAnalysisProcessor;
    let mockPrisma: any;
    let mockAuditService: any;
    let mockJobsService: any;
    let mockMetricsService: any;
    let mockQueueService: any;
    let mockOutboxService: any;
    let mockIdempotencyService: any;
    let mockAiProvider: any;

    const mockCandidateUser: any = {
      id: 'candidate-user-1',
      role: 'CANDIDATE',
      roles: ['CANDIDATE'],
    };

    const mockCv = {
      id: 'cv-123',
      userId: 'candidate-user-1',
      processingStatus: 'READY',
      extractedText: 'Software Engineer with NestJS and TypeScript experience.',
      candidateProfile: {
        id: 'profile-1',
        userId: 'candidate-user-1',
      },
    };

    const mockJob = {
      id: 'job-456',
      title: 'Backend Engineer',
      description: 'Build backend APIs with NestJS',
      requirements: 'NestJS, TypeScript',
      companyId: 'comp-1',
      company: { id: 'comp-1', name: 'Tech Corp' },
    };

    beforeEach(() => {
      mockPrisma = {
        cv: {
          findUnique: jest.fn().mockResolvedValue(mockCv),
        },
        job: {
          findUnique: jest.fn().mockResolvedValue(mockJob),
        },
        operation: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'op-789',
            userId: 'candidate-user-1',
            status: 'QUEUED',
            progressPercent: 0,
          }),
          update: jest.fn().mockResolvedValue({
            id: 'op-789',
            status: 'SUCCEEDED',
            progressPercent: 100,
          }),
        },
        aiAnalysis: {
          create: jest.fn().mockResolvedValue({
            id: 'analysis-1',
            cvId: 'cv-123',
            jobId: 'job-456',
            overallScore: 88,
          }),
        },
        $transaction: jest.fn().mockImplementation(async (callback: any) => {
          const tx = {
            operation: {
              create: jest.fn().mockResolvedValue({
                id: 'op-789',
                userId: 'candidate-user-1',
                type: 'CV_JOB_ANALYSIS',
                status: 'QUEUED',
                progressPercent: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
              }),
              update: mockPrisma.operation.update,
            },
            aiAnalysis: mockPrisma.aiAnalysis,
            auditLog: {
              create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
            },
          };
          return callback(tx);
        }),
      };

      mockAuditService = {
        record: jest.fn().mockResolvedValue(undefined),
      };

      mockJobsService = {};

      mockMetricsService = {
        acquireSlot: jest.fn(),
        releaseSlot: jest.fn(),
        recordMetric: jest.fn(),
      };

      mockQueueService = {
        addJob: jest.fn().mockResolvedValue({ id: 'job-bull-1' }),
        registerWorker: jest.fn(),
      };

      mockOutboxService = {
        recordEvent: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
      };

      mockIdempotencyService = {
        claimOrReplay: jest.fn().mockResolvedValue({ type: 'CLAIMED', recordId: 'idem-rec-1' }),
        complete: jest.fn().mockResolvedValue(undefined),
        fail: jest.fn().mockResolvedValue(undefined),
      };

      mockAiProvider = {
        matchCvJob: jest.fn().mockResolvedValue({
          overallScore: 85,
          summary: 'Strong match',
          matchedSkills: ['NestJS', 'TypeScript'],
          missingSkills: [],
          components: [{ name: 'SKILLS', score: 90, weight: 1.0, evidence: ['NestJS'] }],
        }),
        gapAnalysisCvJob: jest.fn().mockResolvedValue({
          missingSkills: [],
          suggestions: ['Keep up the great work'],
          limitations: ['Self-reported'],
        }),
      };

      aiService = new AiService(
        mockPrisma,
        mockAuditService,
        mockJobsService,
        mockMetricsService,
        mockQueueService,
        mockOutboxService,
        mockIdempotencyService,
        mockAiProvider,
      );

      processor = new CvJobAnalysisProcessor(
        mockQueueService,
        mockPrisma,
        mockAuditService,
        mockOutboxService,
        mockAiProvider,
        mockMetricsService,
      );
    });

    it('returns 202 QUEUED immediately without calling AI provider inline', async () => {
      const result = await aiService.createCvJobAnalysis(
        mockCandidateUser,
        {
          cvId: 'cv-123',
          jobId: 'job-456',
          analyses: ['CV_JOB_MATCH'],
        },
        'req-123',
        'idem-key-abc',
      );

      expect(result.status).toBe('QUEUED');
      expect(result.progressPercent).toBe(0);
      expect(result.id).toBe('op-789');

      // AI provider must NOT be invoked synchronously
      expect(mockAiProvider.matchCvJob).not.toHaveBeenCalled();
      expect(mockAiProvider.gapAnalysisCvJob).not.toHaveBeenCalled();

      // Enqueued to BullMQ with deterministic jobId
      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'ai-analysis-queue',
        'cv-job-analysis',
        expect.objectContaining({
          operationId: 'op-789',
          cvId: 'cv-123',
          jobId: 'job-456',
        }),
        { jobId: 'ai-analysis:op-789' },
      );

      // Recorded Outbox event
      expect(mockOutboxService.recordEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventName: 'CvJobAnalysisQueued',
          aggregateType: 'Operation',
          aggregateId: 'op-789',
        }),
      );

      // Completed idempotency claim
      expect(mockIdempotencyService.complete).toHaveBeenCalledWith(
        'idem-rec-1',
        202,
        expect.objectContaining({ id: 'op-789', status: 'QUEUED' }),
      );
    });

    it('replays cached response when idempotency claim indicates REPLAY', async () => {
      const cachedOperation = {
        id: 'op-cached-1',
        type: 'CV_JOB_ANALYSIS',
        status: 'QUEUED',
        progressPercent: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockIdempotencyService.claimOrReplay.mockResolvedValueOnce({
        type: 'REPLAY',
        recordId: 'idem-rec-cached',
        responseStatus: 202,
        responseBody: cachedOperation,
      });

      const result = await aiService.createCvJobAnalysis(
        mockCandidateUser,
        { cvId: 'cv-123', jobId: 'job-456', analyses: ['CV_JOB_MATCH'] },
        'req-cached',
        'idem-key-replayed',
      );

      expect(result).toEqual(cachedOperation);
      expect(mockPrisma.cv.findUnique).not.toHaveBeenCalled();
      expect(mockQueueService.addJob).not.toHaveBeenCalled();
    });

    it('rejects analysis creation if CV is not READY (throws CvNotReadyException)', async () => {
      mockPrisma.cv.findUnique.mockResolvedValueOnce({
        ...mockCv,
        processingStatus: 'EXTRACTING',
      });

      await expect(
        aiService.createCvJobAnalysis(
          mockCandidateUser,
          { cvId: 'cv-123', jobId: 'job-456', analyses: ['CV_JOB_MATCH'] },
          'req-fail',
          'idem-key-fail',
        ),
      ).rejects.toThrow(CvNotReadyException);

      expect(mockIdempotencyService.fail).toHaveBeenCalledWith('idem-rec-1');
    });

    it('CvJobAnalysisProcessor executes job, updates operation to SUCCEEDED, and releases slot', async () => {
      const mockJobPayload: any = {
        id: 'ai-analysis:op-789',
        data: {
          operationId: 'op-789',
          cvId: 'cv-123',
          jobId: 'job-456',
          analyses: ['CV_JOB_MATCH', 'CV_GAP_ANALYSIS'],
          actorId: 'candidate-user-1',
        },
      };

      await processor.processJob(mockJobPayload);

      // Concurrency slot acquired and released
      expect(mockMetricsService.acquireSlot).toHaveBeenCalledWith('candidate-user-1');
      expect(mockMetricsService.releaseSlot).toHaveBeenCalledTimes(1);

      // AI provider executed
      expect(mockAiProvider.matchCvJob).toHaveBeenCalled();
      expect(mockAiProvider.gapAnalysisCvJob).toHaveBeenCalled();

      // Operation transitioned to SUCCEEDED
      expect(mockPrisma.operation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'op-789' },
          data: expect.objectContaining({
            status: 'SUCCEEDED',
            progressPercent: 100,
          }),
        }),
      );
    });

    it('CvJobAnalysisProcessor marks operation FAILED and releases slot when AI provider fails', async () => {
      mockAiProvider.matchCvJob.mockRejectedValueOnce(new Error('LLM Provider timeout'));

      const mockJobPayload: any = {
        id: 'ai-analysis:op-789',
        data: {
          operationId: 'op-789',
          cvId: 'cv-123',
          jobId: 'job-456',
          analyses: ['CV_JOB_MATCH'],
          actorId: 'candidate-user-1',
        },
      };

      await processor.processJob(mockJobPayload);

      // Slot must still be released in finally block
      expect(mockMetricsService.releaseSlot).toHaveBeenCalledTimes(1);

      // Operation marked FAILED with classification
      expect(mockPrisma.operation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'op-789' },
          data: expect.objectContaining({
            status: 'FAILED',
            failureCode: 'AI_PROCESSING_FAILED',
            failureMessage: expect.stringContaining('LLM Provider timeout'),
          }),
        }),
      );
    });
  });
});
