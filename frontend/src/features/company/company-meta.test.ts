import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCompanyExtendedInfo,
  saveCompanyExtendedInfo,
  DEFAULT_COMPANY_EXTENDED,
} from './company-meta';

describe('company-meta', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default extended info when no custom metadata exists', () => {
    const meta = getCompanyExtendedInfo('test-comp-1');
    expect(meta.companyModel).toBe(DEFAULT_COMPANY_EXTENDED.companyModel);
    expect(meta.companySize).toBe(DEFAULT_COMPANY_EXTENDED.companySize);
    expect(meta.techStack).toEqual(DEFAULT_COMPANY_EXTENDED.techStack);
    expect(meta.reasonsToJoin.length).toBe(3);
    expect(meta.perks.length).toBe(6);
  });

  it('persists and retrieves custom extended info for a company', () => {
    const customInfo = {
      companyModel: 'Product',
      companySize: '50 - 100 nhân viên',
      country: 'Nhật Bản',
      workingTime: 'Thứ 2 - Thứ 6 (9:00 - 18:00)',
      overtimePolicy: 'Không làm thêm giờ (No OT)',
      techStack: ['ReactJS', 'Next.js', 'TypeScript', 'TailwindCSS'],
      reasonsToJoin: [
        { title: 'Lý do 1', content: 'Văn hóa mở' },
        { title: 'Lý do 2', content: 'Lương thưởng cạnh tranh' },
      ],
      perks: [
        { title: 'MacBook M3 Pro', description: 'Cấp máy tính mới 100%' },
      ],
    };

    saveCompanyExtendedInfo('comp-123', customInfo);
    const retrieved = getCompanyExtendedInfo('comp-123');

    expect(retrieved.companyModel).toBe('Product');
    expect(retrieved.companySize).toBe('50 - 100 nhân viên');
    expect(retrieved.country).toBe('Nhật Bản');
    expect(retrieved.overtimePolicy).toBe('Không làm thêm giờ (No OT)');
    expect(retrieved.techStack).toEqual(['ReactJS', 'Next.js', 'TypeScript', 'TailwindCSS']);
    expect(retrieved.reasonsToJoin).toHaveLength(2);
    expect(retrieved.perks[0].title).toBe('MacBook M3 Pro');
  });

  it('returns default info when companyId is undefined or empty', () => {
    const meta = getCompanyExtendedInfo(undefined);
    expect(meta).toEqual(DEFAULT_COMPANY_EXTENDED);
  });
});
