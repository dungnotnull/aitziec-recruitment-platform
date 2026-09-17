import { describe, expect, it } from 'vitest';
import { decodeFileName } from './file-name';

describe('decodeFileName', () => {
  it('handles null, undefined and empty strings', () => {
    expect(decodeFileName(null)).toBe('');
    expect(decodeFileName(undefined)).toBe('');
    expect(decodeFileName('')).toBe('');
  });

  it('keeps standard ASCII file names unchanged', () => {
    expect(decodeFileName('resume.pdf')).toBe('resume.pdf');
    expect(decodeFileName('john_doe_cv_2026.docx')).toBe('john_doe_cv_2026.docx');
  });

  it('decodes real-world Vietnamese mojibake from database', () => {
    // The exact filename stored in DB from Multer latin-1 interpretation of "KHÁM-SỨC-KHỎE-DYM_2026.pdf"
    const mangled = 'KH\u00C3\u0081M-S\u00E1\u00BB\u00A8C-KH\u00E1\u00BB\u008EE-DYM_2026.pdf';
    expect(decodeFileName(mangled)).toBe('KHÁM-SỨC-KHỎE-DYM_2026.pdf');
  });

  it('decodes typical CP1252 mapped mojibake strings', () => {
    // UTF-8 for "Nguyễn_Văn_A.pdf":
    // ễ -> E1 BB 85 (0x85 in CP1252 is '…')
    // ă -> C4 83
    const mangled = 'Nguy\u00E1\u00BB\u2026n_V\u00C4\u0083n_A.pdf';
    expect(decodeFileName(mangled)).toBe('Nguyễn_Văn_A.pdf');
  });

  it('preserves already valid Vietnamese Unicode strings without corruption', () => {
    const valid = 'KHÁM-SỨC-KHỎE-DYM_2026.pdf';
    expect(decodeFileName(valid)).toBe('KHÁM-SỨC-KHỎE-DYM_2026.pdf');

    const valid2 = 'CV_Nguyễn_Văn_An_Frontend_Developer.pdf';
    expect(decodeFileName(valid2)).toBe('CV_Nguyễn_Văn_An_Frontend_Developer.pdf');
  });
});
