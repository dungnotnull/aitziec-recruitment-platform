import { Buffer } from 'node:buffer';

/**
 * Normalizes and sanitizes uploaded CV filenames:
 * 1. Falsy/empty/whitespace fallback to 'document.pdf'.
 * 2. Recovers UTF-8 filename when mojibaked into Latin-1 by Busboy/Multer multipart parameter decoding.
 * 3. Normalizes Unicode to NFC.
 * 4. Extracts basename (strips leading paths and directory separators / and \).
 * 5. Strips control characters (NUL, CR, LF, etc.) and dangerous Unicode bidirectional overrides.
 * 6. Trims whitespace and trailing dots/spaces before extension.
 * 7. Enforces case-insensitive .pdf suffix and max length of 255 characters while preserving the extension.
 * 8. Fallbacks to 'document.pdf' if empty, dots-only, or invalid.
 */
export function normalizeUploadedFilename(rawName?: string | null): string {
  if (!rawName || typeof rawName !== 'string') {
    return 'document.pdf';
  }

  let name = rawName;

  // Step 1: Attempt conditional UTF-8 recovery from Latin-1 mojibake.
  // Busboy defaults to 'latin1' for multipart parameter values when not specified.
  // If all characters in the string are within Latin-1 range (charCode <= 255),
  // it might be a sequence of raw UTF-8 bytes that were decoded as Latin-1.
  const isAllLatin1 = Array.from(name).every((ch) => (ch.codePointAt(0) ?? 0) <= 255);
  if (isAllLatin1) {
    try {
      const latin1Buf = Buffer.from(name, 'latin1');
      // Use fatal: true to strictly fail on invalid UTF-8 byte sequences
      const decoder = new TextDecoder('utf-8', { fatal: true });
      const candidate = decoder.decode(latin1Buf);

      // Verify that candidate round-trips back to the exact same latin1 string
      // to guarantee no data loss and avoid misinterpreting valid non-UTF8 Latin-1
      if (Buffer.from(candidate, 'utf8').toString('latin1') === name && candidate !== name) {
        name = candidate;
      }
    } catch {
      // Not a valid UTF-8 sequence when interpreted as bytes; keep rawName as is
    }
  }

  // Step 2: Unicode normalization (NFC)
  name = name.normalize('NFC');

  // Step 3: Extract basename (strip POSIX / and Windows \ path prefixes)
  const pathParts = name.split(/[/\\]/);
  name = pathParts[pathParts.length - 1] || '';

  // Step 4: Remove NUL, control chars, and dangerous Unicode Bidi / invisible chars
  // Control chars: \x00-\x1F, \x7F-\x9F
  // Bidi overrides & isolates: \u200E, \u200F, \u202A-\u202E, \u2066-\u2069, \u061C
  // Zero-width spaces: \u200B-\u200D, \uFEFF
  name = name.replace(
    /[\x00-\x1F\x7F-\x9F\u200E\u200F\u202A-\u202E\u2066-\u2069\u061C\u200B-\u200D\uFEFF]/g,
    '',
  );

  // Step 5: Trim leading and trailing whitespace
  name = name.trim();

  // If empty or purely dots, fallback
  if (!name || name === '.' || name === '..') {
    return 'document.pdf';
  }

  // Step 6: Ensure .pdf extension
  const MAX_FILENAME_LENGTH = 255;
  const PDF_EXT = '.pdf';

  let baseName = name;
  if (name.toLowerCase().endsWith(PDF_EXT)) {
    baseName = name.slice(0, -PDF_EXT.length);
  }

  // Strip trailing dots or spaces from basename (Windows filesystem safety)
  baseName = baseName.replace(/[. ]+$/, '').trim();

  if (!baseName) {
    return 'document.pdf';
  }

  // Step 7: Enforce length ceiling (max 255 characters total including .pdf)
  const maxBaseLength = MAX_FILENAME_LENGTH - PDF_EXT.length;
  if (baseName.length > maxBaseLength) {
    baseName = baseName.slice(0, maxBaseLength).trimEnd();
  }

  return `${baseName}${PDF_EXT}`;
}
