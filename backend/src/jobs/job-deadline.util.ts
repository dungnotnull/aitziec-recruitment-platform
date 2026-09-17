import { BadRequestException } from '@nestjs/common';
import { ERROR_CODES } from '../common/constants/error-codes';

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATETIME_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Validates whether a year/month/day tuple represents a real Gregorian calendar date.
 */
export function isValidGregorianDate(year: number, month: number, day: number): boolean {
  if (year < 1 || month < 1 || month > 12 || day < 1) {
    return false;
  }
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

/**
 * Parses and normalizes applicationDeadline according to BE-21-002:
 * 1. Exact date-only `YYYY-MM-DD` is validated against the Gregorian calendar and
 *    normalized to the end of the day in UTC: `YYYY-MM-DDT23:59:59.999Z`.
 * 2. Full ISO-8601 datetimes preserve their exact instant and timezone representation.
 * 3. Enforces `deadline.getTime() > now.getTime()` strictly after normalization.
 * 4. Rejects invalid dates, invalid leap days, malformed inputs, and non-future instants
 *    with 400 VALIDATION_ERROR.
 */
export function parseApplicationDeadline(value: string, now: Date = new Date()): Date {
  if (!value || typeof value !== 'string') {
    throw new BadRequestException({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'applicationDeadline must be a valid future ISO UTC date.',
    });
  }

  const trimmed = value.trim();
  const dateOnlyMatch = trimmed.match(DATE_ONLY_REGEX);

  let deadline: Date;

  if (dateOnlyMatch) {
    const year = parseInt(dateOnlyMatch[1], 10);
    const month = parseInt(dateOnlyMatch[2], 10);
    const day = parseInt(dateOnlyMatch[3], 10);

    if (!isValidGregorianDate(year, month, day)) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'applicationDeadline must be a valid future ISO UTC date.',
      });
    }

    deadline = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  } else {
    const isoMatch = trimmed.match(ISO_DATETIME_REGEX);
    if (!isoMatch) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'applicationDeadline must be a valid future ISO UTC date.',
      });
    }

    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    const hour = parseInt(isoMatch[4], 10);
    const minute = parseInt(isoMatch[5], 10);
    const second = parseInt(isoMatch[6], 10);

    if (!isValidGregorianDate(year, month, day) || hour > 23 || minute > 59 || second > 59) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'applicationDeadline must be a valid future ISO UTC date.',
      });
    }

    deadline = new Date(trimmed);
    if (isNaN(deadline.getTime())) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'applicationDeadline must be a valid future ISO UTC date.',
      });
    }
  }

  if (deadline.getTime() <= now.getTime()) {
    throw new BadRequestException({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'applicationDeadline must be a valid future ISO UTC date.',
    });
  }

  return deadline;
}
