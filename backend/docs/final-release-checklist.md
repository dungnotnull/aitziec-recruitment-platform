# Danh Sách Kiểm Tra Phát Hành Chính Thức (Final Release Checklist - BE-7-025)

Tài liệu này xác nhận toàn bộ các hạng mục điều kiện tiên quyết trước khi phát hành phiên bản production chính thức của ITZiec Recruitment Platform Backend v1.0.0.

---

## Bảng Kiểm Tra Hạng Mục Phát Hành

- [x] **Hợp đồng API (Contract Fidelity):** Toàn bộ 54 approved endpoints và data types tuân thủ 100% tài liệu [API-CONTRACT.md](file:///c:/Users/ROG/Downloads/Work/aitziec-recruitment-platform/API-CONTRACT.md).
- [x] **Di chuyển cơ sở dữ liệu (Migrations Safety):** Toàn bộ 5 tệp migration chính thức được kiểm chứng, áp dụng trơn tru không lỗi.
- [x] **Kiểm thử tự động (Test Automation):**
  - Unit Tests: 21 test suites, 119 tests PASS 100%.
  - E2E Tests: 9 test suites, 86 tests PASS 100%.
- [x] **Chất lượng mã nguồn (Code Quality & Lint):**
  - Linter: 0 errors (`npm run lint`).
  - Build: Mã thoát 0 sạch sẽ (`npm run build`).
- [x] **Bảo mật & Phân quyền (Security & Authorization):**
  - 0 lỗ hổng bảo mật high/critical (`npm audit`).
  - Đã rà soát ma trận phân quyền và rò rỉ dữ liệu [authorization-and-data-exposure-review.md](file:///c:/Users/ROG/Downloads/Work/aitziec-recruitment-platform/backend/docs/authorization-and-data-exposure-review.md).
  - Đã kiểm thử các ca lạm dụng và brute-force [abuse-cases.spec.ts](file:///c:/Users/ROG/Downloads/Work/aitziec-recruitment-platform/backend/test/unit/abuse-cases.spec.ts).
- [x] **Hiệu năng & Tải (Performance & Scalability):**
  - P95 Latency tìm kiếm đạt 5.62ms (mục tiêu < 100ms).
  - Tỷ lệ lỗi chịu tải: 0.00%.
- [x] **Khả năng quan sát (Observability):**
  - Prometheus metrics endpoint `GET /metrics` hoạt động.
  - Sổ tay cảnh báo và dashboard đã được phê duyệt.
- [x] **Sao lưu & Khôi phục thảm họa (Backup & Disaster Recovery):**
  - Đã thực hiện diễn tập khôi phục thảm họa (RTO đạt 6 phút 15s, RPO 0).
- [x] **Sổ tay vận hành (Runbooks):** 6 quy trình xử lý sự cố đã hoàn tất tại [operational-runbooks.md](file:///c:/Users/ROG/Downloads/Work/aitziec-recruitment-platform/backend/docs/operational-runbooks.md).
- [x] **Phê duyệt phát hành:** ĐỦ ĐIỀU KIỆN GẮN TAG PHÁT HÀNH CHÍNH THỨC V1.0.0.

---

## Bảng Kiểm Tra Hạng Mục Phát Hành Phase 10 (Reliability & Clean Architecture Hardening)

- [x] **Hợp đồng & Envelope Parity (BE-10-012, BE-10-013, BE-10-015):**
  - `GET /jobs/:id/save` trả về chuẩn `{ data: { isSaved: boolean }, meta: { requestId } }`.
  - `GET /recommendations/jobs` trả về chuẩn canonical `RecommendedJobDto` (nested `job`, `score`, `reasonCodes`, `evidence`, `limitations`), không flat field và không `as any`.
  - `GET /notifications` trả về nested `resource: { type, id } | null`, loại bỏ `userId` nội bộ, hỗ trợ phân trang cursor opaque base64 `(createdAt, id)`.
  - `PATCH /notifications/:id/read` yêu cầu strictly `{ read: boolean }`.
- [x] **Tính Bất Biến & Bất Khả Trùng Lặp (Idempotency - BE-10-004–006, BE-10-010):**
  - Idempotency key 16–128 ký tự ASCII, băm canonical request hash, TTL 24 giờ.
  - Hỗ trợ replay an toàn các endpoint tạo đơn, đổi trạng thái đơn, đặt lịch phỏng vấn, retry CV, và phân tích AI.
  - Chặn payload tampering với mã lỗi `409 IDEMPOTENCY_KEY_REUSED`.
- [x] **Xử Lý Bất Đồng Bộ & Outbox Pattern (BE-10-007–011):**
  - `OutboxDispatcherService` quét định kỳ và gửi event vào hàng đợi BullMQ an toàn.
  - Bộ xử lý worker: `NotificationProcessor`, `EmailProcessor`, `CvExtractionProcessor`, `CvJobAnalysisProcessor`, `InvitationDeliveryWorker`.
  - Cơ chế phục hồi stale operation và chịu lỗi khi queue gặp sự cố (`503 QUEUE_INFRASTRUCTURE_ERROR`).
- [x] **Bảo Mật Bí Mật Thư Mời (BE-10-011):**
  - Mã hóa AES-256-GCM token gốc qua `CompanyInvitationDeliverySecret`.
  - Bảng chính chỉ lưu SHA-256 acceptance hash. Bản ghi secret bị xóa sau khi gửi email thành công.
- [x] **Chất Lượng Mã Nguồn & Loại Bỏ Explicit `any` (BE-10-014):**
  - 0 `any` trong toàn bộ mã production (`src/**`).
  - Kích hoạt quy tắc `@typescript-eslint/no-explicit-any: error`.
  - Linter: 0 errors, 0 warnings (`npm run lint`).
  - Build: Mã thoát 0 sạch sẽ (`npm run build`).
- [x] **Kiểm Thử Tự Động Toàn Diện (Full Automated Test Suites):**
  - Unit Tests: 27 test suites, 260 tests PASS 100% (`npm test`).
  - E2E Tests: 10 test suites, 145 tests PASS 100% (`npm run test:e2e`).
- [x] **Di Chuyển Cơ Sở Dữ Liệu (Migrations Safety):**
  - `20260912000000_default_cv_partial_unique_index`
  - `20260912100000_idempotency_records`
  - `20260912200000_company_invitation_delivery_secret`
- [x] **Tài Liệu Bàn Giao Frontend (Frontend Handoff):**
  - Đã biên soạn đầy đủ tại [docs/frontend-handoff-phase-10.md](file:///c:/Users/ROG/Downloads/Work\aitziec-recruitment-platform\backend\docs\frontend-handoff-phase-10.md).
  - Tuyệt đối không chỉnh sửa mã nguồn frontend (`../frontend/**`).
- [x] **Phê Duyệt Phát Hành:** ĐỦ ĐIỀU KIỆN HOÀN TẤT VÀ BÀN GIAO CHÍNH THỨC PHASE 10.
