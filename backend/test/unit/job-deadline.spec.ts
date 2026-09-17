import { parseApplicationDeadline, isValidGregorianDate } from '../../src/jobs/job-deadline.util';
import { BadRequestException } from '@nestjs/common';

describe('parseApplicationDeadline (Unit - BE-21-002)', () => {
  const fixedNow = new Date('2026-09-17T12:00:00.000Z');

  describe('isValidGregorianDate', () => {
    it('validates leap years correctly', () => {
      expect(isValidGregorianDate(2028, 2, 29)).toBe(true);
      expect(isValidGregorianDate(2024, 2, 29)).toBe(true);
      expect(isValidGregorianDate(2000, 2, 29)).toBe(true);
      expect(isValidGregorianDate(1900, 2, 29)).toBe(false);
      expect(isValidGregorianDate(2026, 2, 29)).toBe(false);
      expect(isValidGregorianDate(2026, 2, 28)).toBe(true);
    });

    it('rejects invalid months and days', () => {
      expect(isValidGregorianDate(2026, 0, 10)).toBe(false);
      expect(isValidGregorianDate(2026, 13, 10)).toBe(false);
      expect(isValidGregorianDate(2026, 4, 31)).toBe(false);
      expect(isValidGregorianDate(2026, 4, 30)).toBe(true);
      expect(isValidGregorianDate(2026, 1, 32)).toBe(false);
      expect(isValidGregorianDate(2026, 1, 31)).toBe(true);
    });
  });

  describe('date-only input normalization', () => {
    it('normalizes today date-only to 23:59:59.999Z without throwing 400 mid-day', () => {
      const deadline = parseApplicationDeadline('2026-09-17', fixedNow);
      expect(deadline.toISOString()).toBe('2026-09-17T23:59:59.999Z');
      expect(deadline.getTime()).toBeGreaterThan(fixedNow.getTime());
    });

    it('normalizes future date-only to 23:59:59.999Z', () => {
      const deadline = parseApplicationDeadline('2026-09-30', fixedNow);
      expect(deadline.toISOString()).toBe('2026-09-30T23:59:59.999Z');
    });

    it('accepts valid future leap day and normalizes to end-of-day UTC', () => {
      const deadline = parseApplicationDeadline('2028-02-29', fixedNow);
      expect(deadline.toISOString()).toBe('2028-02-29T23:59:59.999Z');
    });

    it('rejects yesterday date-only with 400 VALIDATION_ERROR', () => {
      expect(() => parseApplicationDeadline('2026-09-16', fixedNow)).toThrow(BadRequestException);
    });

    it('rejects invalid leap day (e.g. 2026-02-29) with 400 VALIDATION_ERROR', () => {
      expect(() => parseApplicationDeadline('2026-02-29', fixedNow)).toThrow(BadRequestException);
    });

    it('rejects non-existent dates (2026-02-30, 2026-13-01, 2026-04-31) with 400', () => {
      expect(() => parseApplicationDeadline('2026-02-30', fixedNow)).toThrow(BadRequestException);
      expect(() => parseApplicationDeadline('2026-13-01', fixedNow)).toThrow(BadRequestException);
      expect(() => parseApplicationDeadline('2026-04-31', fixedNow)).toThrow(BadRequestException);
    });

    it('rejects unpadded or malformed date-only strings', () => {
      expect(() => parseApplicationDeadline('2026-9-17', fixedNow)).toThrow(BadRequestException);
      expect(() => parseApplicationDeadline('2026-09-17-extra', fixedNow)).toThrow(
        BadRequestException,
      );
      expect(() => parseApplicationDeadline('not-a-date', fixedNow)).toThrow(BadRequestException);
      expect(() => parseApplicationDeadline('', fixedNow)).toThrow(BadRequestException);
    });
  });

  describe('full ISO datetime input', () => {
    it('preserves exact instant of valid future ISO datetime', () => {
      const input = '2026-10-01T15:30:00.000Z';
      const deadline = parseApplicationDeadline(input, fixedNow);
      expect(deadline.toISOString()).toBe('2026-10-01T15:30:00.000Z');
    });

    it('rejects past full ISO datetime with 400 VALIDATION_ERROR', () => {
      expect(() => parseApplicationDeadline('2026-09-16T12:00:00.000Z', fixedNow)).toThrow(
        BadRequestException,
      );
    });

    it('rejects full ISO datetime exactly equal to now', () => {
      expect(() => parseApplicationDeadline('2026-09-17T12:00:00.000Z', fixedNow)).toThrow(
        BadRequestException,
      );
    });

    it('rejects full ISO datetime with invalid calendar date (no month rollover)', () => {
      expect(() => parseApplicationDeadline('2026-02-30T10:00:00.000Z', fixedNow)).toThrow(
        BadRequestException,
      );
    });
  });
});
