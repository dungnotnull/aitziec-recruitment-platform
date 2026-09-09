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
