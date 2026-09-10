/**
 * PII Redaction utility for AI context preparation (BE-6-001, BE-6-007, BE-6-019)
 * Redacts sensitive applicant information before passing text to external AI services.
 */
export class PiiRedactor {
  // Regex patterns for sensitive applicant data
  private static readonly EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

  private static readonly PHONE_REGEX =
    /(?:\+84|84|0)(?:3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])\d{7}\b|(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g;

  private static readonly NATIONAL_ID_REGEX =
    /\b(?:CCCD|CMND|ID|Passport)?\s*[:#]?\s*(\d{9}|\d{12})\b/gi;

  private static readonly ADDRESS_PREFIX_REGEX =
    /(?:Địa chỉ|Address|Số nhà|Tổ|Thôn|Ngõ|Ngách)\s*[:#]?\s*[^,\n]{5,50}(?:,|$)/gi;

  /**
   * Redacts sensitive personal information while retaining technical and professional content.
   */
  static redact(rawText: string): string {
    if (!rawText) return '';

    let sanitized = rawText;

    // 1. Redact emails
    sanitized = sanitized.replace(this.EMAIL_REGEX, '[REDACTED_EMAIL]');

    // 2. Redact national ID / passport
    sanitized = sanitized.replace(this.NATIONAL_ID_REGEX, '[REDACTED_ID]');

    // 3. Redact phone numbers
    sanitized = sanitized.replace(this.PHONE_REGEX, '[REDACTED_PHONE]');

    // 4. Redact detailed street addresses
    sanitized = sanitized.replace(this.ADDRESS_PREFIX_REGEX, '[REDACTED_ADDRESS], ');

    return sanitized;
  }

  /**
   * Checks if a given text contains unredacted raw sensitive personal info.
   */
  static containsSensitivePii(text: string): boolean {
    if (!text) return false;
    return (
      this.EMAIL_REGEX.test(text) ||
      this.PHONE_REGEX.test(text) ||
      this.NATIONAL_ID_REGEX.test(text)
    );
  }
}
