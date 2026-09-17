/**
 * Utility to decode and format filenames that may have been mangled by multipart form
 * parsers (such as Busboy/Multer in Express/NestJS) interpreting UTF-8 bytes as Latin-1 / Windows-1252.
 *
 * Example: 'KHÃ M-Sá»¨C-KHá»ŽE-DYM_2026.pdf' -> 'KHÁM-SỨC-KHỎE-DYM_2026.pdf'
 */

const CP1252_MAP: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87,
  'ˆ': 0x88, '‰': 0x89, 'Š': 0x8A, '‹': 0x8B, 'Œ': 0x8C, 'Ž': 0x8E, '‘': 0x91,
  '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98,
  '™': 0x99, 'š': 0x9A, '›': 0x9B, 'œ': 0x9C, 'ž': 0x9E, 'Ÿ': 0x9F,
};

export function decodeFileName(fileName: string | null | undefined): string {
  if (!fileName) return '';

  try {
    const bytes = new Uint8Array(fileName.length);
    let hasMojibakeChars = false;

    for (let i = 0; i < fileName.length; i++) {
      const char = fileName[i];
      if (CP1252_MAP[char] !== undefined) {
        bytes[i] = CP1252_MAP[char];
        hasMojibakeChars = true;
      } else {
        const code = fileName.charCodeAt(i);
        // If there's a character > 255 (like already-decoded Vietnamese letters Ứ, ơ, đ),
        // then this string is already a proper Unicode string and not a byte-mapped string.
        if (code > 255) {
          return fileName;
        }
        if (code >= 128) {
          hasMojibakeChars = true;
        }
        bytes[i] = code;
      }
    }

    if (!hasMojibakeChars) {
      return fileName;
    }

    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return decoded;
  } catch {
    // In case of invalid UTF-8 byte sequences, fallback to original filename safely
    return fileName;
  }
}
