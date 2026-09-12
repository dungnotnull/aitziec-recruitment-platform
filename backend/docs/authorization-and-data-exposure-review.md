# Báo Cáo Rà Soát Phân Quyền & Rò Rỉ Dữ Liệu (Authorization & Data Exposure Review - BE-7-013)

Tài liệu này tổng hợp kết quả kiểm toán an ninh phân quyền (RBAC & Multi-tenant Scoping) và rà soát chống rò rỉ dữ liệu nhạy cảm theo tiêu chuẩn NFR-SEC-001 và NFR-SEC-004–005.

---

## 1. Ma Trận Phân Quyền Endpoint & Phạm Vi (Scope Matrix)

| Endpoint | Quyền Tối Thiểu | Phạm Vi Dữ Liệu (Resource Scoping) | Biện Pháp Bảo Vệ |
| :--- | :--- | :--- | :--- |
| `GET /candidates/me` | `CANDIDATE` | Chỉ truy cập profile của chính User ID | Token JWT xác thực |
| `POST /companies` | `HR` | Tạo công ty mới và tự động gán vai trò `OWNER` | Xác thực JWT |
| `PATCH /companies/:id` | `HR` | Bắt buộc là thành viên có vai trò `OWNER` | Kiểm tra quan hệ membership |
| `POST /companies/:id/jobs` | `HR` | Bắt buộc thuộc công ty (`OWNER` hoặc `RECRUITER`) | Kiểm tra quan hệ membership |
| `POST /jobs/:id/applications` | `CANDIDATE` | Ứng viên nộp hồ sơ, không được nộp trùng | Unique key `(candidateId, jobId)` |
| `GET /jobs/:id/applications` | `HR` | Chỉ HR thuộc công ty sở hữu Job mới được xem | Kiểm tra quan hệ company |
| `POST /applications/:id/transitions` | `HR` | Chỉ HR thuộc công ty quản lý job | State Machine + `expectedVersion` |
| `GET /ai/analyses/:id` | `CANDIDATE` / `HR` | Ứng viên sở hữu CV hoặc HR của Job liên quan | Ma trận `authorizeAnalysisRead` |
| `/admin/*` | `ADMIN` | Toàn quyền kiểm duyệt hệ thống | Chặn `CANDIDATE` & `HR` (`403`) |

---

## 2. Kết Quả Quét Rò Rỉ Dữ Liệu Nhạy Cảm (Sensitive Data Scans)

Toàn bộ các endpoint API đã được quét kiểm thử tự động để bảo đảm:
1. **Mật khẩu & Hash:** Tuyệt đối không bao giờ xuất hiện `password` hay `passwordHash` trong bất kỳ response nào (Auth, Users, Admin).
2. **Tokens & Sessions:** Refresh token chỉ lưu dạng hash một chiều SHA-256 (`tokenHash`) và truyền qua cookie `HttpOnly`, `SameSite=Strict`.
3. **Thông tin định danh PII của ứng viên:**
   - Khi HR chưa nhận được đơn ứng tuyển, không thể tra cứu thông tin cá nhân của ứng viên.
   - Khi gửi CV sang AI Provider, toàn bộ email, số điện thoại, CCCD và địa chỉ chi tiết bị ẩn danh hóa (`PiiRedactor`).
4. **Kết luận:** **KHÔNG CÓ LỖ HỔNG RÒ RỈ DỮ LIỆU CẤP ĐỘ CAO (ZERO HIGH/CRITICAL FINDINGS).**

---

## 3. Bổ Sung Rà Soát & Thắt Chặt An Ninh Dữ Liệu Phase 10 (Phase 10 Hardening)

Trong khuôn khổ Phase 10, hệ thống đã được gia cố thêm các chốt chặn an ninh chuyên sâu:
1. **Chặn Nộp Đơn Bằng CV Của Ứng Viên Khác (BE-10-001):**
   - Thực thi kiểm tra quyền sở hữu CV (`candidateProfileId` khớp với candidate của người dùng) ngay bên trong transaction tạo application.
   - Nếu CV không thuộc ứng viên hoặc không ở trạng thái `READY`, hệ thống trả về `404 RESOURCE_NOT_FOUND`, tuyệt đối không rò rỉ sự tồn tại hay trạng thái CV của người khác.
2. **Bảo Vệ Bí Mật Thư Mời Gia Nhập Công Ty (BE-10-011):**
   - Mã mời (`token`) chỉ lưu dạng băm SHA-256 trên bảng `CompanyInvitation`.
   - Token gốc phục vụ gửi email được mã hóa đối xứng AES-256-GCM (`CompanyInvitationDeliverySecret`) với khóa `INVITATION_TOKEN_ENCRYPTION_KEY`.
   - Token thô tuyệt đối không xuất hiện trong API response, audit log, outbox payload hay dead-letter metadata. Bản ghi bí mật bị xóa ngay sau khi gửi email thành công hoặc khi thư mời hết hạn.
3. **Ẩn Danh Hóa Resource Trong Notification Projection (BE-10-013):**
   - Projection thông báo chỉ trả về `{ resource: { type, id } | null }`, loại bỏ triệt để trường `userId` nội bộ và các trường root `resourceType`/`resourceId`.
4. **Bảo Mật Chi Tiết Phỏng Vấn (BE-10-006 / BE-8-018):**
   - Khi ứng viên truy cập `GET /interviews/:id`, toàn bộ ghi chú nội bộ của nhà tuyển dụng (`recruiterPrivateNotes`, `recruiterFeedback`) bị loại bỏ hoàn toàn khỏi response.
5. **Khử Bỏ Dữ Liệu Nhạy Cảm Khỏi Log & Outbox (BE-10-007 / BE-10-014):**
   - Tất cả sự kiện outbox và bản ghi log đều qua bộ lọc `redactSensitiveData` và `sanitizeEventPayload` để loại bỏ token, password, và thông tin nhạy cảm.
