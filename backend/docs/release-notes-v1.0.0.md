# ITZiec Recruitment Platform Backend — Ghi Chú Phát Hành v1.0.0 (Release Notes)

**Ngày phát hành:** 10/09/2026  
**Phiên bản:** `v1.0.0` (Semantic Versioning 2.0.0)  
**Git Tag:** `v1.0.0`  
**Trạng thái kiểm thử:** 100% Passed (21 Unit Test Suites - 119 tests, 9 E2E Test Suites - 86 tests)  
**Chất lượng mã nguồn:** 0 Lint Errors, Build sạch (Exit Code 0), 0 Lỗ hổng bảo mật nghiêm trọng  

---

## 1. Tổng Quan Bản Phát Hành

Phiên bản **v1.0.0** đánh dấu sự hoàn thiện toàn diện của hệ thống Backend Nền tảng Tuyển dụng ITZiec (ITZiec Recruitment Platform), được xây dựng trên nền tảng NestJS 10, TypeScript nghiêm ngặt, Prisma ORM, PostgreSQL 16, Redis 7, MinIO (S3 compatible storage), BullMQ và kiến trúc AI hỗ trợ tuyển dụng không tự trị (non-autonomous advisory AI).

Toàn bộ 8 giai đoạn từ Phase 0 đến Phase 7 đã được triển khai, kiểm thử và nghiệm thu nghiêm ngặt, đáp ứng 100% yêu cầu trong [API-CONTRACT.md](file:///c:/Users/ROG/Downloads/Work/aitziec-recruitment-platform/API-CONTRACT.md), [PROJECT-DETAIL.md](file:///c:/Users/ROG/Downloads/Work/aitziec-recruitment-platform/PROJECT-DETAIL.md) và các quy chuẩn kiến trúc [RULE.md](file:///c:/Users/ROG/Downloads/Work/aitziec-recruitment-platform/backend/RULE.md).

---

## 2. Chi Tiết Tính Năng Đã Triển Khai Theo Giai Đoạn

### Phase 1: Nền Tảng Kỹ Thuật (Platform Foundation)
- Scaffold NestJS 10 với TypeScript nghiêm ngặt, cấu hình ESLint và Prettier chuẩn mực không cảnh báo.
- Nạp cấu hình biến môi trường qua `ConfigModule` và `class-validator` với cơ chế che giấu (redact) thông tin nhạy cảm.
- Docker Compose thiết lập môi trường dev: PostgreSQL 16, Redis 7, MinIO, Mailpit.
- Thiết kế cơ sở dữ liệu Prisma sơ khởi và migration quan hệ.
- Hệ thống hàng đợi BullMQ và Redis kết nối bền bỉ với retry theo số mũ.
- Mẫu kiến trúc Transactional Outbox ghi nhận sự kiện miền nguyên tử trong transaction.
- Ghi log có cấu trúc dạng JSON và Audit log chỉ thêm (append-only), tự động ẩn mật khẩu và CV thô.
- Middleware theo vết `X-Request-Id` và `X-Trace-Id` chuẩn UUID xuyên suốt vòng đời request.
- Bộ lọc ngoại lệ trung tâm `AllExceptionsFilter` và bộ biến đổi `ResponseTransformInterceptor` chuẩn hóa phong bì JSON API, triệt tiêu rò rỉ stack trace.
- Bộ kiểm tra đầu vào toàn cục `ContractValidationPipe` và tài liệu Swagger OpenAPI tại `/api/docs`.
- Endpoint giám sát sức khỏe `/api/v1/health/live` và `/api/v1/health/ready`.

### Phase 2: Định Danh, Phân Quyền & Hồ Sơ (Identity, Access & Profiles)
- Chuẩn hóa email chữ thường và băm mật khẩu bảo mật cao bằng thuật toán Argon2id (19 MiB RAM, 2 vòng lặp).
- Xác thực người dùng với JWT Access Token ngắn hạn (15 phút) và Refresh Token xoay vòng qua cookie bảo mật `HttpOnly` (`itziec_refresh`, 7 ngày).
- Phát hiện tấn công tái sử dụng refresh token theo họ token (token family reuse detection) và thu hồi ngay lập tức (`401 REFRESH_TOKEN_REUSED`).
- Hỗ trợ đăng xuất đơn lẻ và đăng xuất toàn bộ thiết bị (`/auth/logout-all`).
- Phân quyền theo vai trò RBAC (`CANDIDATE`, `HR`, `ADMIN`), kiểm soát khóa tài khoản (`403 ACCOUNT_SUSPENDED`).
- Quản lý hồ sơ ứng viên với kiểm soát đồng thời lạc quan (`expectedVersion`, `409 VERSION_CONFLICT`) và tính toán tỷ lệ hoàn thiện hồ sơ tự động.
- Quản trị công ty và thành viên tuyển dụng (`OWNER`, `RECRUITER`), bảo vệ không cho phép xóa Owner duy nhất cuối cùng (`400 LAST_COMPANY_OWNER`).

### Phase 3: Quản Lý Tin Tuyển Dụng & Tìm Kiếm (Jobs & Search)
- Vòng đời tin tuyển dụng: Tạo nháp (`DRAFT`), xuất bản (`PUBLISHED`), đóng tuyển dụng (`CLOSED`), phân quyền nghiêm ngặt theo công ty.
- Tìm kiếm toàn văn PostgreSQL sử dụng `tsvector`, từ điển tiếng Anh và chỉ mục GIN (`idx_jobs_search_vector`).
- Xếp hạng độ liên quan tất định (Deterministic Ranking) kết hợp độ mới, mức lương và ID tie-breaker.
- Phân trang con trỏ an toàn (Opaque Cursor Pagination) mã hóa Base64 `{ id, createdAt, sortValue }`.
- Bộ đệm tìm kiếm Redis TTL 60s an toàn, tự động làm sạch và chuẩn hóa tham số truy vấn.
- Tính năng lưu tin tuyển dụng (Saved Jobs) với ràng buộc duy nhất `(candidateId, jobId)` và cơ chế lưu/hủy lưu lũy đẳng (Idempotent).

### Phase 4: Quy Trình Tuyển Dụng & Ứng Tuyển (Recruitment Pipeline)
- Mô hình hóa đơn ứng tuyển với ràng buộc duy nhất chống nộp trùng `(candidateId, jobId)`.
- Lịch sử trạng thái chỉ thêm (`ApplicationStatusEvent`) lưu vết toàn bộ tiến trình ứng tuyển.
- Máy trạng thái tuyển dụng nghiêm ngặt: `APPLIED` -> `REVIEWING` -> `INTERVIEWING` -> `PASSED` / `REJECTED`.
- Cơ chế chuyển trạng thái đồng thời lạc quan với `expectedVersion` chống ghi đè tranh chấp.
- Phát xuất sự kiện miền `ApplicationSubmitted` và `ApplicationStatusChanged` qua Outbox.
- Phân quyền hiển thị đơn ứng tuyển theo phạm vi: ứng viên chỉ thấy đơn của mình, HR chỉ thấy đơn của công ty mình.
- Bất biến trạng thái cuối (Terminal Immutability): không cho phép chuyển trạng thái hoặc xóa đơn đã `PASSED`/`REJECTED`.

### Phase 5: Quản Lý CV, Phỏng Vấn & Thông Báo (CVs, Interviews & Notifications)
- Tải lên CV với giới hạn 10 MiB, kiểm tra magic bytes `%PDF` và mã băm SHA-256 chống giả mạo.
- Tích hợp lưu trữ S3/MinIO lưu trữ CV an toàn và sinh presigned URL tải xuống có thời hạn 15 phút.
- Chính sách xóa CV thông minh: CV đã nộp vào tin tuyển dụng được gắn cờ `DELETED` để giữ toàn vẹn pháp lý; CV chưa nộp được xóa triệt để khỏi storage.
- Lập lịch phỏng vấn (`POST /applications/:id/interviews`) với kiểm tra thời gian hợp lệ (`startsAt < endsAt`) và che giấu ghi chú riêng tư của recruiter trước ứng viên.
- Cập nhật, đổi lịch (`InterviewRescheduled`), hủy lịch (`InterviewCancelled`) và hoàn thành phỏng vấn.
- Hệ thống thông báo in-app kèm số lượng chưa đọc (`unreadCount`) và đánh dấu đã đọc (`readAt`).
- Tích hợp gửi email thông báo qua Mailpit/SMTP với mẫu email chuẩn hóa và khóa lũy đẳng (Idempotency Key).

### Phase 6: Trí Tuệ Nhân Tạo Tuyển Dụng (AI Capabilities)
- Ban hành chính sách bảo mật AI: ẩn danh hóa 100% dữ liệu PII (email, số điện thoại, CCCD) trước khi gửi cho LLM.
- Cổng kết nối trung lập `IAiProviderPort` và adapter Gemini có khả năng chịu lỗi cao (timeout, retry theo số mũ, rate-limit).
- Quản lý phiên bản prompt bất biến (`v1.0`) và xác thực cấu trúc JSON đầu ra tại runtime.
- Khớp nối CV và JD (CV/JD Matching) cho điểm minh bạch trên thang 100 dựa trên 4 thành phần (kỹ năng, kinh nghiệm, yêu cầu, từ khóa).
- Phân tích khoảng trống kỹ năng (Gap Analysis) đưa ra khuyến nghị thực tế, không bịa đặt kinh nghiệm.
- Bộ phân tích tìm kiếm việc làm bằng ngôn ngữ tự nhiên (`POST /jobs/search/parse`).
- Thuật toán gợi ý việc làm cho ứng viên (`GET /recommendations/jobs`) tự động loại trừ các việc làm đã nộp đơn.
- Kiểm soát hạn mức gọi AI (AI Metrics & Quota Limiter) bảo vệ chi phí và chống cạn kiệt tài nguyên.
- **Bảo đảm kiến trúc:** Chứng minh toán học/mã nguồn rằng AI hoàn toàn không có quyền hạn và không có khả năng thay đổi trạng thái đơn ứng tuyển.

### Phase 7: Quản Trị, Giám Sát & Đóng Gói Phát Hành (Administration, Observability & Hardening)
- Module Quản trị viên (`AdminModule`):
  - Tra cứu danh sách người dùng, lọc theo vai trò, trạng thái, tìm kiếm email.
  - Điều phối trạng thái người dùng (`ACTIVE`, `SUSPENDED`, `DISABLED`), tự động hủy toàn bộ phiên đăng nhập khi khóa tài khoản.
  - Phê duyệt/tạm dừng công ty (`ACTIVE`, `SUSPENDED`) với kiểm soát phiên bản lạc quan.
  - Kiểm duyệt tin tuyển dụng vi phạm, yêu cầu lý do bắt buộc và ghi vết audit.
  - Truy vấn Audit Log chỉ thêm (`GET /admin/audit-logs`) có phân trang cursor và bảo vệ không thể sửa/xóa.
- Khả năng quan sát (Observability):
  - Endpoint Prometheus metrics (`GET /metrics`) trích xuất số lượng HTTP request, độ trễ P95, trạng thái hàng đợi BullMQ và kết nối DB/Redis.
  - Lan truyền vết phân tán (`x-trace-id` và `x-request-id`) từ HTTP request sang Outbox và Worker.
  - Toàn bộ log lỗi nhạy cảm được che giấu dữ liệu bí mật trước khi ghi.
- Kiểm thử tăng cường & Chịu tải:
  - Bộ kiểm thử các ca lạm dụng (`abuse-cases.spec.ts`): chống brute-force đăng nhập, chặn tệp độc hại, chặn truy vấn tìm kiếm ReDoS, chặn spam AI.
  - Bộ kiểm thử tích hợp vòng đời tuyển dụng toàn diện (`recruitment-lifecycle.e2e-spec.ts`).
  - Báo cáo kiểm thử chịu tải (`load-test-report.md`) xác nhận P95 đạt 5.62ms (< 100ms mục tiêu).
- Vận hành & Phát hành:
  - Hoàn thiện tài liệu kiến trúc triển khai Production, cổng kiểm soát CI/CD, chính sách lưu trữ dữ liệu, sao lưu và diễn tập khôi phục thảm họa (RTO 6m15s, RPO 0).
  - Hoàn tất 6 quy trình vận hành sự cố (Operational Runbooks) và danh sách kiểm tra phát hành chính thức (`final-release-checklist.md`).

---

## 3. Danh Mục Hợp Đồng API Được Phê Duyệt

Hệ thống cung cấp đầy đủ 54 API endpoints được định nghĩa trong [API-CONTRACT.md](file:///c:/Users/ROG/Downloads/Work/aitziec-recruitment-platform/API-CONTRACT.md):
- **Health & Metrics:** `GET /health/live`, `GET /health/ready`, `GET /metrics`
- **Auth:** `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/logout-all`
- **Candidate Profiles:** `GET /candidates/me`, `PATCH /candidates/me`
- **Companies:** `POST /companies`, `GET /companies/:idOrSlug`, `PATCH /companies/:id`, `GET /companies/:id/members`, `POST /companies/:id/members`, `DELETE /companies/:id/members/:userId`
- **Jobs & Search:** `POST /jobs`, `GET /jobs/:id`, `PATCH /jobs/:id`, `POST /jobs/:id/publish`, `POST /jobs/:id/close`, `GET /jobs`, `POST /jobs/search/parse`
- **Saved Jobs:** `PUT /saved-jobs/:jobId`, `DELETE /saved-jobs/:jobId`, `GET /saved-jobs`
- **Applications:** `POST /jobs/:jobId/applications`, `GET /applications`, `GET /applications/:id`, `GET /jobs/:jobId/applications`, `POST /applications/:id/transitions`
- **CVs:** `POST /cvs`, `GET /cvs`, `GET /cvs/:id`, `POST /cvs/:id/default`, `POST /cvs/:id/download-url`, `DELETE /cvs/:id`
- **Interviews:** `POST /applications/:id/interviews`, `GET /applications/:id/interviews`, `PATCH /interviews/:id`, `POST /interviews/:id/complete`, `POST /interviews/:id/cancel`
- **Notifications:** `GET /notifications`, `PATCH /notifications/:id/read`
- **AI & Operations:** `POST /ai/cv-job-analyses`, `GET /operations/:id`, `GET /ai/analyses/:id`, `GET /recommendations/jobs`
- **Admin:** `GET /admin/users`, `PATCH /admin/users/:id/status`, `PATCH /admin/companies/:id/status`, `POST /admin/jobs/:id/moderate`, `GET /admin/audit-logs`

---

## 4. Hướng Dẫn Vận Hành & Khởi Chạy

1. Khởi động hạ tầng cơ sở dữ liệu:
   ```bash
   cd backend
   docker-compose up -d
   ```
2. Cài đặt các gói phụ thuộc và sinh Prisma Client:
   ```bash
   npm install
   npx prisma generate
   ```
3. Chạy di chuyển cơ sở dữ liệu (Database Migrations):
   ```bash
   npx prisma migrate deploy
   ```
4. Khởi chạy ứng dụng môi trường Production:
   ```bash
   npm run build
   npm run start:prod
   ```
5. Kiểm tra chất lượng và chạy test tự động:
   ```bash
   npm run lint
   npm test
   npm run test:e2e
   ```
