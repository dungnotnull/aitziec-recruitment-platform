import { JobExpirationScheduler } from '../../src/jobs/job-expiration.scheduler';

describe('JobExpirationScheduler (Unit - BE-11-004)', () => {
  let scheduler: JobExpirationScheduler;
  let mockPrisma: any;
  let mockAudit: any;
  let mockConfig: any;

  const baseDate = new Date('2026-10-01T12:00:00.000Z');

  beforeEach(() => {
    mockPrisma = {
      job: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    mockAudit = {
      record: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };
    mockConfig = {
      get: jest.fn().mockImplementation((key: string, defaultValue: any) => defaultValue),
    };

    scheduler = new JobExpirationScheduler(
      mockPrisma,
      mockAudit,
      mockConfig,
      () => baseDate, // fixed clock
    );
  });

  it('expires only PUBLISHED jobs with deadline before fixed now', async () => {
    const overdueJob = {
      id: 'job-overdue',
      companyId: 'comp-1',
      version: 2,
      status: 'PUBLISHED',
      applicationDeadline: new Date('2026-10-01T11:59:59.000Z'),
    };

    mockPrisma.job.findMany.mockResolvedValue([overdueJob]);
    mockPrisma.job.updateMany.mockResolvedValue({ count: 1 });

    const count = await scheduler.expireOverdueJobs(baseDate);

    expect(count).toBe(1);
    expect(mockPrisma.job.findMany).toHaveBeenCalledWith({
      where: {
        status: 'PUBLISHED',
        applicationDeadline: { lt: baseDate },
      },
      select: {
        id: true,
        version: true,
        companyId: true,
        applicationDeadline: true,
      },
      take: 100,
    });
    expect(mockPrisma.job.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'job-overdue',
        status: 'PUBLISHED',
        applicationDeadline: { lt: baseDate },
        version: 2,
      },
      data: {
        status: 'EXPIRED',
        version: 3,
      },
    });
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'JOB_EXPIRED',
        targetId: 'job-overdue',
        metadata: expect.objectContaining({
          previousStatus: 'PUBLISHED',
          newStatus: 'EXPIRED',
          previousVersion: 2,
          newVersion: 3,
        }),
      }),
    );
  });

  it('is completely idempotent: second run returns 0 and does not duplicate audit', async () => {
    // First run finds 1 overdue job
    mockPrisma.job.findMany.mockResolvedValueOnce([
      {
        id: 'job-1',
        companyId: 'comp-1',
        version: 1,
        status: 'PUBLISHED',
        applicationDeadline: new Date('2026-09-30T00:00:00.000Z'),
      },
    ]);
    mockPrisma.job.updateMany.mockResolvedValueOnce({ count: 1 });

    const firstRun = await scheduler.expireOverdueJobs(baseDate);
    expect(firstRun).toBe(1);
    expect(mockAudit.record).toHaveBeenCalledTimes(1);

    // Second run: no more published overdue jobs found
    mockPrisma.job.findMany.mockResolvedValueOnce([]);

    const secondRun = await scheduler.expireOverdueJobs(baseDate);
    expect(secondRun).toBe(0);
    expect(mockAudit.record).toHaveBeenCalledTimes(1); // No new audit
  });

  it('handles race condition when another instance already updated the job (updateMany returns count 0)', async () => {
    mockPrisma.job.findMany.mockResolvedValue([
      {
        id: 'job-raced',
        companyId: 'comp-1',
        version: 1,
        status: 'PUBLISHED',
        applicationDeadline: new Date('2026-09-30T00:00:00.000Z'),
      },
    ]);
    // Atomic update fails because another process changed status/version
    mockPrisma.job.updateMany.mockResolvedValue({ count: 0 });

    const count = await scheduler.expireOverdueJobs(baseDate);

    expect(count).toBe(0);
    expect(mockAudit.record).not.toHaveBeenCalled(); // No audit written
  });

  it('does not crash on database failure and returns partial count safely', async () => {
    mockPrisma.job.findMany.mockRejectedValue(new Error('DB connection timeout'));

    const count = await scheduler.expireOverdueJobs(baseDate);
    expect(count).toBe(0);
  });

  it('skips concurrent execution when already processing', async () => {
    mockPrisma.job.findMany.mockImplementation(async () => {
      // While findMany is in flight, call expireOverdueJobs again
      const concurrentResult = await scheduler.expireOverdueJobs(baseDate);
      expect(concurrentResult).toBe(0);
      return [];
    });

    const result = await scheduler.expireOverdueJobs(baseDate);
    expect(result).toBe(0);
  });
});
