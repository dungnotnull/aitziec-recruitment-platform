# Chính Sách Lưu Trữ & Xóa Dữ Liệu (Data Retention & Deletion Policy - BE-7-018)

Tài liệu này xác định thời hạn lưu trữ và quy trình xóa dữ liệu cho từng thực thể trong hệ thống ITZiec theo CV-006, AUDIT-002–003, BEI-002 và NFR-SEC-003.

---

## 1. Thời Hạn Lưu Trữ Theo Thực Thể

| Thực Thể | Thời Hạn Lưu Trữ | Chính Sách Xóa (Soft/Hard Delete) | Ngoại Lệ Pháp Lý & Kiểm Toán |
| :--- | :--- | :--- | :--- |
| **CV chưa nộp đơn** | Cho đến khi ứng viên xóa | Hard delete (Xóa file MinIO & xóa dòng DB) | Không |
| **CV đã nộp đơn ứng tuyển** | 2 năm kể từ ngày nộp đơn | **Soft delete** (`processingStatus: DELETED`). File lưu trữ vẫn giữ cho HR xét duyệt. | Bảo lưu bằng chứng tuyển dụng |
| **Đơn ứng tuyển (`applications`)** | 3 năm kể từ ngày đóng quy trình | **Bất biến (Immutable)**. Không có API xóa đơn ứng tuyển. | Tuân thủ quy định pháp luật lao động |
| **Phiên đăng nhập (`refresh_sessions`)** | 7 ngày kể từ khi hết hạn | Tự động xóa định kỳ (Cron cleanup) | Không |
| **Nhật ký kiểm toán (`audit_logs`)** | **5 năm** | **Bất biến, Append-only**. Không cho phép chỉnh sửa hoặc xóa | Yêu cầu tuân thủ an ninh & pháp lý |
| **Trạng thái tiến trình (`operations`)** | 30 ngày | Tự động dọn dẹp sau 30 ngày | Phục vụ kiểm tra sự cố gần nhất |

---

## 2. Quyền Được Lãng Quên (GDPR Right to be Forgotten)

Khi ứng viên yêu cầu xóa tài khoản:
1. Trạng thái user chuyển sang `DISABLED`.
2. Toàn bộ refresh tokens bị thu hồi ngay lập tức (`isRevoked: true`).
3. Thông tin cá nhân (họ tên, email, số điện thoại, địa chỉ) được ẩn danh hóa vĩnh viễn (`[DELETED_USER_...]`).
4. Các bản ghi `audit_logs` bảo lưu hành động với `actorId` trỏ về null (`ON DELETE SET NULL`) để giữ tính toàn vẹn kiểm toán.
