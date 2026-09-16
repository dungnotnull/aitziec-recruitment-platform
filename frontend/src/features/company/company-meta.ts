export interface CompanyReasonToJoin {
  title: string;
  content: string;
}

export interface CompanyPerk {
  title: string;
  description: string;
}

export interface CompanyExtendedInfo {
  companyModel: string;
  companySize: string;
  country: string;
  workingTime: string;
  overtimePolicy: string;
  techStack: string[];
  reasonsToJoin: CompanyReasonToJoin[];
  perks: CompanyPerk[];
}

export const DEFAULT_COMPANY_EXTENDED: CompanyExtendedInfo = {
  companyModel: 'Product & IT Solutions',
  companySize: '100 - 499 nhân viên',
  country: 'Việt Nam / Global',
  workingTime: 'Thứ 2 - Thứ 6 (8:30 - 17:30)',
  overtimePolicy: 'Không áp lực OT',
  techStack: ['Java', 'Spring Boot', 'ReactJS', 'TypeScript', 'PostgreSQL', 'Docker', 'AWS'],
  reasonsToJoin: [
    {
      title: 'Môi trường công nghệ mở, phát triển chuyên sâu',
      content: 'Làm việc trực tiếp với các kiến trúc hệ thống hiện đại, áp dụng quy trình CI/CD tự động và Agile/Scrum bài bản.',
    },
    {
      title: 'Đãi ngộ cạnh tranh & Thưởng hiệu suất minh bạch',
      content: 'Lương tháng 13 cam kết, thưởng theo kết quả kinh doanh, xét tăng lương định kỳ 2 lần mỗi năm dựa trên năng lực.',
    },
    {
      title: 'Văn hóa tôn trọng & Cân bằng cuộc sống',
      content: 'Chính sách làm việc linh hoạt (Hybrid/Remote), không áp lực OT, hỗ trợ kinh phí học tập và chứng chỉ công nghệ quốc tế.',
    },
  ],
  perks: [
    {
      title: 'Lương & Thưởng',
      description: 'Lương tháng 13 đảm bảo, thưởng nóng hiệu suất dự án theo quý.',
    },
    {
      title: 'Bảo hiểm sức khỏe',
      description: 'Gói bảo hiểm chăm sóc sức khỏe toàn diện cho nhân viên & gia đình.',
    },
    {
      title: 'Thiết bị hiện đại',
      description: 'Cấp máy tính MacBook Pro / ThinkPad cấu hình cao & màn hình phụ 4K.',
    },
    {
      title: '15+ Ngày phép năm',
      description: '15 đến 18 ngày phép năm cùng các ngày nghỉ đặc biệt hưởng lương.',
    },
    {
      title: 'Pantry & Giải trí',
      description: 'Trà, cà phê, trái cây miễn phí cùng khu vực giải trí PlayStation / Bi-lắc.',
    },
    {
      title: 'Company Trip',
      description: 'Du lịch nghỉ dưỡng hàng năm tại các resort 5 sao và tiệc Year End Party.',
    },
  ],
};

const STORAGE_PREFIX = 'itziec_company_ext_';

export function getCompanyExtendedInfo(companyId?: string): CompanyExtendedInfo {
  if (!companyId) return DEFAULT_COMPANY_EXTENDED;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${companyId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_COMPANY_EXTENDED,
        ...parsed,
        techStack: Array.isArray(parsed.techStack) ? parsed.techStack : DEFAULT_COMPANY_EXTENDED.techStack,
        reasonsToJoin: Array.isArray(parsed.reasonsToJoin) && parsed.reasonsToJoin.length > 0 
          ? parsed.reasonsToJoin 
          : DEFAULT_COMPANY_EXTENDED.reasonsToJoin,
        perks: Array.isArray(parsed.perks) && parsed.perks.length > 0
          ? parsed.perks
          : DEFAULT_COMPANY_EXTENDED.perks,
      };
    }
  } catch (err) {
    console.warn('Failed to parse company extended info from localStorage:', err);
  }
  return DEFAULT_COMPANY_EXTENDED;
}

export function saveCompanyExtendedInfo(companyId: string, info: CompanyExtendedInfo): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${companyId}`, JSON.stringify(info));
  } catch (err) {
    console.warn('Failed to save company extended info to localStorage:', err);
  }
}
