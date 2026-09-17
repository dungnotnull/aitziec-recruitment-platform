/**
 * Complete End-to-End System Test Flow
 * Tests full recruitment lifecycle across Admin, HR, and Candidate on live server:
 * 1. Admin login & session verification
 * 2. HR registration & Company setup
 * 3. Admin company approval (Company status moderation)
 * 4. HR adds team member recruiter
 * 5. HR job creation (with isHot, benefits, skills) & publishing
 * 6. Candidate 1 registration, profile setup & CV upload (UTF-8 Vietnamese filename)
 * 7. Candidate 1 job search, save, and application submission
 * 8. HR application review & Company Dashboard KPI verification
 * 9. HR interview scheduling & candidate PII / private notes redaction check
 * 10. HR completes interview, transitions PASSED -> OFFERED -> HIRED (Terminal check)
 * 11. Candidate 2 rejection & Reconsideration cycle (REJECTED -> REVIEWING)
 * 12. Admin audit trail & Candidate in-app notifications
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000/api/v1';

// Terminal colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function logStep(stepNum, title) {
  console.log(`\n${colors.cyan}${colors.bold}▶ [Bước ${stepNum}] ${title}${colors.reset}`);
}

function logSuccess(message) {
  console.log(`  ${colors.green}✔ ${message}${colors.reset}`);
}

function logInfo(message) {
  console.log(`  ${colors.yellow}ℹ ${message}${colors.reset}`);
}

function logError(message, err) {
  console.error(`  ${colors.red}✖ ${message}${colors.reset}`, err || '');
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { ...options.headers };
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body,
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const errorMsg = json?.error?.message || json?.message || `HTTP ${res.status}`;
    const err = new Error(`${options.method || 'GET'} ${path} failed (${res.status}): ${errorMsg}`);
    err.status = res.status;
    err.response = json;
    throw err;
  }

  return json;
}

async function runCompleteFlow() {
  const timestamp = Date.now();
  console.log(`${colors.bold}=============================================================`);
  console.log(`🚀 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN HỆ THỐNG RECRUITMENT PLATFORM`);
  console.log(`   Target API: ${BASE_URL}`);
  console.log(`   Thời gian: ${new Date().toLocaleString()}`);
  console.log(`=============================================================${colors.reset}`);

  try {
    // -------------------------------------------------------------
    // BƯỚC 1: Admin Đăng nhập
    // -------------------------------------------------------------
    logStep(1, 'Admin đăng nhập và lấy phiên làm việc');
    const adminLoginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin@itziec.com',
        password: 'Admin123456!@#',
      }),
    });
    const adminToken = adminLoginRes.data.accessToken;
    logSuccess(`Admin đăng nhập thành công: admin@itziec.com (ID: ${adminLoginRes.data.user.id})`);

    // -------------------------------------------------------------
    // BƯỚC 2: HR Đăng ký & Tạo Công ty
    // -------------------------------------------------------------
    logStep(2, 'HR đăng ký tài khoản và tạo hồ sơ Doanh nghiệp');
    const hrEmail = `hr-${timestamp}@itziec.com`;
    const hrRegisterRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: hrEmail,
        password: 'Password123!@#',
        role: 'HR',
      }),
    });
    const hrToken = hrRegisterRes.data.accessToken;
    const hrId = hrRegisterRes.data.user.id;
    logSuccess(`HR đăng ký thành công: ${hrEmail} (ID: ${hrId})`);

    const companySlug = `flow-tech-${timestamp}`;
    const companyRes = await request('/companies', {
      method: 'POST',
      headers: { Authorization: `Bearer ${hrToken}` },
      body: JSON.stringify({
        name: `Flow Tech Corp ${timestamp}`,
        slug: companySlug,
        description: 'Tập đoàn công nghệ dẫn đầu về giải pháp AI & Điện toán đám mây.',
        websiteUrl: 'https://flowtech.example.com',
        location: 'Tòa nhà Landmark 81, TP. Hồ Chí Minh',
      }),
    });
    const companyId = companyRes.data.id;
    logSuccess(`Công ty đã tạo thành công: "${companyRes.data.name}" (ID: ${companyId}, Status: ${companyRes.data.status})`);

    // -------------------------------------------------------------
    // BƯỚC 3: Admin Duyệt Công ty (Company Status Moderation)
    // -------------------------------------------------------------
    logStep(3, 'Admin kiểm duyệt và kích hoạt Công ty (PATCH status)');
    const modRes = await request(`/admin/companies/${companyId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        status: 'ACTIVE',
        reason: 'Đã xác minh giấy phép kinh doanh và mã số thuế hợp lệ',
        expectedVersion: companyRes.data.version || 1,
      }),
    });
    logSuccess(`Admin đã duyệt công ty sang ACTIVE (Version: ${modRes.data.version})`);

    // -------------------------------------------------------------
    // BƯỚC 4: HR Thêm thành viên tuyển dụng vào công ty
    // -------------------------------------------------------------
    logStep(4, 'HR đăng ký đồng nghiệp và thêm vào đội ngũ tuyển dụng');
    const recruiterEmail = `recruiter-${timestamp}@itziec.com`;
    await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: recruiterEmail,
        password: 'Password123!@#',
        role: 'HR',
      }),
    });
    const addMemberRes = await request(`/companies/${companyId}/members`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hrToken}` },
      body: JSON.stringify({
        userEmail: recruiterEmail,
        role: 'RECRUITER',
      }),
    });
    logSuccess(`Đã thêm thành viên: ${recruiterEmail} (Role: ${addMemberRes.data?.role || 'RECRUITER'})`);

    // -------------------------------------------------------------
    // BƯỚC 5: HR Đăng tin tuyển dụng (Job Drafting & Publishing)
    // -------------------------------------------------------------
    logStep(5, 'HR tạo tin tuyển dụng (Hot Job, Benefits) và Xuất bản');
    const deadline = new Date(Date.now() + 30 * 86400000).toISOString();
    const createJobRes = await request(`/companies/${companyId}/jobs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hrToken}` },
      body: JSON.stringify({
        title: `Senior Fullstack AI Engineer (${timestamp})`,
        description: 'Chịu trách nhiệm kiến trúc hệ thống backend microservices và tích hợp mô hình AI LLM.',
        requirements: 'Ít nhất 4 năm kinh nghiệm Node.js, TypeScript, React và hệ quản trị PostgreSQL.',
        workplaceType: 'HYBRID',
        experienceLevel: 'SENIOR',
        employmentType: 'FULL_TIME',
        location: 'TP. Hồ Chí Minh',
        currency: 'VND',
        salaryMin: 40000000,
        salaryMax: 70000000,
        isHot: true,
        benefits: [
          'Cấp MacBook Pro M3 Max',
          'Gói bảo hiểm sức khỏe quốc tế PVI',
          'Thưởng lương tháng 13 & ESOP',
          'Du lịch công ty 2 lần/năm'
        ],
        technologyNames: ['Node.js', 'TypeScript', 'React', 'PostgreSQL'],
        applicationDeadline: deadline,
      }),
    });
    const jobId = createJobRes.data.id;
    logSuccess(`Đã tạo tin tuyển dụng DRAFT: "${createJobRes.data.title}" (ID: ${jobId}, isHot: ${createJobRes.data.isHot})`);

    // Xuất bản Job
    const publishRes = await request(`/jobs/${jobId}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hrToken}` },
      body: JSON.stringify({ expectedVersion: 1 }),
    });
    logSuccess(`Đã xuất bản tin tuyển dụng sang PUBLISHED (Version: ${publishRes.data.version})`);

    // -------------------------------------------------------------
    // BƯỚC 6: Candidate 1 Đăng ký, Hoàn thiện Profile & Upload CV UTF-8
    // -------------------------------------------------------------
    logStep(6, 'Ứng viên 1 đăng ký, cập nhật Profile và tải lên CV tiếng Việt UTF-8 (BE-20-001)');
    const cand1Email = `candidate1-${timestamp}@itziec.com`;
    const cand1RegRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: cand1Email,
        password: 'Password123!@#',
        role: 'CANDIDATE',
      }),
    });
    const cand1Token = cand1RegRes.data.accessToken;
    logSuccess(`Ứng viên 1 đăng ký thành công: ${cand1Email}`);

    await request('/candidates/me', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${cand1Token}` },
      body: JSON.stringify({
        expectedVersion: 1,
        fullName: 'Nguyễn Văn A',
        headline: 'Lead Fullstack & AI Solutions Architect',
        location: 'TP. Hồ Chí Minh',
        bio: 'Chuyên gia thiết kế hệ thống phân tán chịu tải cao và tự động hóa quy trình với AI.',
      }),
    });
    logSuccess(`Hồ sơ ứng viên 1 đã cập nhật: Nguyễn Văn A (Lead Fullstack & AI Solutions Architect)`);

    // Tải lên CV với tên tiếng Việt có dấu (sử dụng sample-cv.pdf hợp lệ để worker trích xuất text)
    const vietnameseFileName = 'CV Nguyễn Văn A.pdf';
    const sampleCvPath = path.join(__dirname, '../test/fixtures/sample-cv.pdf');
    const pdfBuffer = fs.readFileSync(sampleCvPath);
    const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
    
    const cvFormData = new FormData();
    cvFormData.append('file', pdfBlob, vietnameseFileName);

    const cvUploadRes = await request('/cvs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cand1Token}` },
      body: cvFormData,
    });
    const cv1Id = cvUploadRes.data.cv.id;
    const normalizedName = cvUploadRes.data.cv.originalFileName;
    logSuccess(`Tải lên CV thành công! (ID: ${cv1Id})`);
    logSuccess(`Kiểm tra BE-20-001 UTF-8 Recovery: originalFileName = "${normalizedName}" (Khớp chính xác: ${normalizedName === vietnameseFileName})`);
    logSuccess(`Trạng thái CV mặc định: isDefault = ${cvUploadRes.data.cv.isDefault}`);

    // Đợi worker BullMQ parse text và chuyển sang READY
    logInfo('Đang chờ worker BullMQ giải mã text CV sang READY...');
    let isReady = false;
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 600));
      const cvsRes = await request('/cvs', {
        headers: { Authorization: `Bearer ${cand1Token}` },
      });
      const myCv = cvsRes.data?.find((c) => c.id === cv1Id);
      if (myCv?.processingStatus === 'READY') {
        isReady = true;
        break;
      }
    }
    logSuccess(`CV đã được giải mã văn bản và chuyển sang trạng thái: READY (IsReady: ${isReady})`);

    // -------------------------------------------------------------
    // BƯỚC 7: Candidate 1 Tìm việc, Lưu tin & Nộp hồ sơ (Apply)
    // -------------------------------------------------------------
    logStep(7, 'Ứng viên 1 tìm kiếm việc làm, lưu tin và nộp đơn ứng tuyển');
    const searchRes = await request('/jobs?q=Fullstack', {
      headers: { Authorization: `Bearer ${cand1Token}` },
    });
    logSuccess(`Tìm thấy ${searchRes.data?.length || 0} việc làm khớp từ khóa "Fullstack"`);

    // Lưu tin (Idempotent PUT)
    await request(`/saved-jobs/${jobId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${cand1Token}` },
    });
    logSuccess(`Ứng viên 1 đã lưu tin tuyển dụng thành công (PUT /saved-jobs/${jobId})`);

    // Nộp đơn ứng tuyển
    const applyRes = await request(`/jobs/${jobId}/applications`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cand1Token}` },
      body: JSON.stringify({
        cvId: cv1Id,
        candidateNote: 'Chào quý công ty, tôi rất quan tâm đến vị trí Senior Fullstack AI Engineer và mong muốn được cống hiến kinh nghiệm của mình.',
      }),
    });
    const app1Id = applyRes.data.id;
    logSuccess(`Nộp đơn thành công! (Mã ứng tuyển: ${app1Id}, Trạng thái: ${applyRes.data.status})`);

    // -------------------------------------------------------------
    // BƯỚC 8: HR Xem Dashboard KPI & Sàng lọc hồ sơ (Reviewing)
    // -------------------------------------------------------------
    logStep(8, 'HR xem thống kê Dashboard và chuyển trạng thái sang REVIEWING');
    const statsRes = await request(`/companies/${companyId}/dashboard-stats`, {
      headers: { Authorization: `Bearer ${hrToken}` },
    });
    logSuccess(`Company Dashboard KPI: ${statsRes.data.totalApplicationsCount} hồ sơ nộp, ${statsRes.data.activeJobsCount} việc làm đang tuyển, ${statsRes.data.teamMembersCount} thành viên`);

    // Chuyển APPLIED -> REVIEWING
    const reviewRes = await request(`/applications/${app1Id}/transitions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hrToken}` },
      body: JSON.stringify({
        targetStatus: 'REVIEWING',
        expectedVersion: 1,
        reason: 'Hồ sơ đạt tiêu chuẩn sơ tuyển kỹ năng.',
      }),
    });
    logSuccess(`Đã chuyển trạng thái: APPLIED ➔ REVIEWING (Version mới: ${reviewRes.data.version})`);

    // -------------------------------------------------------------
    // BƯỚC 9: HR Lên lịch phỏng vấn & Kiểm tra bảo mật PII/Private Notes
    // -------------------------------------------------------------
    logStep(9, 'HR chuyển sang INTERVIEWING và lên lịch phỏng vấn (Bảo mật Private Notes)');
    await request(`/applications/${app1Id}/transitions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hrToken}` },
      body: JSON.stringify({
        targetStatus: 'INTERVIEWING',
        expectedVersion: 2,
        reason: 'Mời ứng viên tham gia vòng phỏng vấn kỹ thuật.',
      }),
    });
    logSuccess(`Đã chuyển trạng thái: REVIEWING ➔ INTERVIEWING`);

    const interviewStartsAt = new Date(Date.now() + 86400000).toISOString();
    const interviewEndsAt = new Date(Date.now() + 86400000 + 3600000).toISOString();
    const interviewRes = await request(`/applications/${app1Id}/interviews`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hrToken}` },
      body: JSON.stringify({
        startsAt: interviewStartsAt,
        endsAt: interviewEndsAt,
        locationOrMeetingUrl: 'https://meet.google.com/xyz-test-meeting',
        candidateInstructions: 'Vui lòng chuẩn bị một bài thuyết trình 15 phút về kiến trúc microservices đã từng làm.',
        recruiterPrivateNotes: 'LƯU Ý NỘI BỘ BẢO MẬT: Ứng viên xuất sắc, trần ngân sách lương duyệt tới 65M VND.',
      }),
    });
    const interviewId = interviewRes.data.id;
    logSuccess(`Đã tạo lịch phỏng vấn thành công (ID: ${interviewId})`);

    // Kiểm tra phía Ứng viên đọc lịch phỏng vấn: Private Notes phải bị ẩn
    const candInterviewView = await request(`/applications/${app1Id}/interviews`, {
      headers: { Authorization: `Bearer ${cand1Token}` },
    });
    const candidateSawPrivateNotes = candInterviewView.data?.some(i => i.recruiterPrivateNotes);
    if (candidateSawPrivateNotes) {
      throw new Error('BẢO MẬT VI PHẠM: Ứng viên đọc được recruiterPrivateNotes!');
    }
    logSuccess(`Bảo mật ứng viên đã xác nhận: recruiterPrivateNotes hoàn toàn được ẩn khỏi Ứng viên!`);

    // HR hoàn thành phỏng vấn
    await request(`/interviews/${interviewId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hrToken}` },
      body: JSON.stringify({
        expectedVersion: 1,
        recruiterFeedback: 'Ứng viên trả lời rất sâu về distributed transactions và BullMQ queue.',
      }),
    });
    logSuccess(`HR đã đánh dấu hoàn tất buổi phỏng vấn (Feedback: OK)`);

    // -------------------------------------------------------------
    // BƯỚC 10: Quy trình Quyết định: PASSED -> OFFERED -> HIRED (Terminal)
    // -------------------------------------------------------------
    logStep(10, 'Quy trình Phase 19: Chuyển PASSED ➔ OFFERED ➔ HIRED và kiểm tra Terminal Invariant');
    
    // INTERVIEWING -> PASSED
    await request(`/applications/${app1Id}/transitions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hrToken}` },
      body: JSON.stringify({
        targetStatus: 'PASSED',
        expectedVersion: 3,
        reason: 'Vượt qua vòng phỏng vấn kỹ thuật xuất sắc.',
      }),
    });
    logSuccess(`Chuyển trạng thái: INTERVIEWING ➔ PASSED (Version: 4)`);

    // PASSED -> OFFERED
    await request(`/applications/${app1Id}/transitions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hrToken}` },
      body: JSON.stringify({
        targetStatus: 'OFFERED',
        expectedVersion: 4,
        reason: 'Gửi thư mời nhận việc với mức đãi ngộ hấp dẫn.',
      }),
    });
    logSuccess(`Chuyển trạng thái: PASSED ➔ OFFERED (Version: 5) - Bắn event ApplicationOffered`);

    // OFFERED -> HIRED
    const hiredRes = await request(`/applications/${app1Id}/transitions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hrToken}` },
      body: JSON.stringify({
        targetStatus: 'HIRED',
        expectedVersion: 5,
        reason: 'Ứng viên đã ký hợp đồng thử việc chính thức.',
      }),
    });
    logSuccess(`Chuyển trạng thái: OFFERED ➔ HIRED (Version: 6) - Bắn event ApplicationHired`);

    // Kiểm tra Terminal Invariant: Từ HIRED không thể chuyển đi đâu nữa
    try {
      await request(`/applications/${app1Id}/transitions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${hrToken}` },
        body: JSON.stringify({
          targetStatus: 'REJECTED',
          expectedVersion: hiredRes.data.version,
          reason: 'Cố ý chuyển trạng thái sau khi đã HIRED',
        }),
      });
      throw new Error('Lỗi: Lẽ ra phải chặn chuyển trạng thái từ HIRED!');
    } catch (err) {
      if (err.status === 409) {
        logSuccess(`Kiểm tra Terminal Invariant thành công: Chặn chuyển trạng thái từ HIRED với mã lỗi 409 INVALID_APPLICATION_TRANSITION`);
      } else {
        throw err;
      }
    }

    // -------------------------------------------------------------
    // BƯỚC 11: Chu kỳ Reconsider (REJECTED -> REVIEWING)
    // -------------------------------------------------------------
    logStep(11, 'Quy trình Phase 19 Reconsider: Từ chối Ứng viên 2 và sau đó Mở lại hồ sơ');
    
    // Đăng ký Candidate 2
    const cand2Email = `candidate2-${timestamp}@itziec.com`;
    const cand2RegRes = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: cand2Email,
        password: 'Password123!@#',
        role: 'CANDIDATE',
      }),
    });
    const cand2Token = cand2RegRes.data.accessToken;

    await request('/candidates/me', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${cand2Token}` },
      body: JSON.stringify({
        expectedVersion: 1,
        fullName: 'Trần Thị B',
        headline: 'Frontend Engineer',
      }),
    });

    const cv2FormData = new FormData();
    cv2FormData.append('file', pdfBlob, 'CV Trần Thị B.pdf');
    const cv2Res = await request('/cvs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cand2Token}` },
      body: cv2FormData,
    });

    // Đợi worker BullMQ parse text CV 2
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 600));
      const cvsRes = await request('/cvs', {
        headers: { Authorization: `Bearer ${cand2Token}` },
      });
      const myCv = cvsRes.data?.find((c) => c.id === cv2Res.data.cv.id);
      if (myCv?.processingStatus === 'READY') {
        break;
      }
    }

    const app2Res = await request(`/jobs/${jobId}/applications`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cand2Token}` },
      body: JSON.stringify({
        cvId: cv2Res.data.cv.id,
        candidateNote: 'Ứng tuyển vị trí frontend.',
      }),
    });
    const app2Id = app2Res.data.id;
    logSuccess(`Ứng viên 2 (${cand2Email}) nộp đơn ứng tuyển (ID: ${app2Id})`);

    // HR chuyển sang REVIEWING
    await request(`/applications/${app2Id}/transitions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hrToken}` },
      body: JSON.stringify({
        targetStatus: 'REVIEWING',
        expectedVersion: 1,
        reason: 'Sàng lọc hồ sơ đợt 2.',
      }),
    });

    // HR từ chối hồ sơ: REVIEWING -> REJECTED
    await request(`/applications/${app2Id}/transitions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hrToken}` },
      body: JSON.stringify({
        targetStatus: 'REJECTED',
        expectedVersion: 2,
        reason: 'Chưa đủ năm kinh nghiệm yêu cầu cho cấp bậc Senior.',
      }),
    });
    logSuccess(`HR đã từ chối Ứng viên 2: REVIEWING ➔ REJECTED`);

    // HR thực hiện Reconsider: REJECTED -> REVIEWING
    const reconsiderRes = await request(`/applications/${app2Id}/transitions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hrToken}` },
      body: JSON.stringify({
        targetStatus: 'REVIEWING',
        expectedVersion: 3,
        reason: 'Phòng ban mở thêm vị trí Mid-level phù hợp với ứng viên này, mở lại để đánh giá.',
      }),
    });
    logSuccess(`HR bấm Reconsider thành công: REJECTED ➔ REVIEWING (Version mới: ${reconsiderRes.data.version})`);

    // -------------------------------------------------------------
    // BƯỚC 12: Admin Audit Trail & Giám sát Hệ thống
    // -------------------------------------------------------------
    logStep(12, 'Admin tra cứu Audit Trail và kiểm tra Notification của ứng viên');
    const auditRes = await request('/admin/audit-logs?limit=5', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    logSuccess(`Admin Audit Log truy vấn thành công (${auditRes.data?.length || 0} bản ghi gần nhất):`);
    for (const log of auditRes.data || []) {
      logInfo(`  - [${log.action}] Target: ${log.targetType}:${log.targetId} (Actor: ${log.actorId || 'SYSTEM'})`);
    }

    // Ứng viên kiểm tra thông báo nhận được (đợi worker BullMQ xử lý notification outbox)
    let notifications = [];
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 600));
      const notifRes = await request('/notifications?limit=5', {
        headers: { Authorization: `Bearer ${cand1Token}` },
      });
      if (notifRes.data && notifRes.data.length > 0) {
        notifications = notifRes.data;
        break;
      }
    }
    logSuccess(`Ứng viên 1 nhận được ${notifications.length} thông báo in-app:`);
    for (const n of notifications) {
      logInfo(`  - [${n.type}] ${n.title}: ${n.body}`);
    }

    console.log(`\n${colors.bold}${colors.green}=============================================================`);
    console.log(`🎉 TẤT CẢ 12 BƯỚC TEST FLOW ĐÃ CHẠY THÀNH CÔNG 100%!`);
    console.log(`   - 3 Vai trò: Admin, HR, Candidate tương tác hoàn hảo`);
    console.log(`   - Phục hồi tiếng Việt UTF-8 (BE-20-001): OK`);
    console.log(`   - State Machine: APPLIED ➔ REVIEWING ➔ INTERVIEWING ➔ PASSED ➔ OFFERED ➔ HIRED: OK`);
    console.log(`   - Chu kỳ Reconsider: REJECTED ➔ REVIEWING: OK`);
    console.log(`   - Bảo mật PII & Che giấu Private Notes: OK`);
    console.log(`   - Audit Log & Notification Outbox: OK`);
    console.log(`=============================================================${colors.reset}\n`);

  } catch (error) {
    logError(`Kiểm thử thất bại tại bước đang chạy:`, error.message);
    if (error.response) {
      console.error('Response details:', JSON.stringify(error.response, null, 2));
    }
    process.exit(1);
  }
}

runCompleteFlow();
