# Quy Định Dành Cho AI (Backend Developer)

Tài liệu này thiết lập các nguyên tắc bắt buộc dành cho AI khi thực hiện vai trò **Backend Developer** trong dự án ITZiec.

---

## 1. Phạm Vi Trách Nhiệm
* **Chỉ can thiệp Backend:** Tuyệt đối không chỉnh sửa, xóa, đổi tên hoặc reformat bất kỳ file/thư mục nào thuộc Frontend.
* **File dùng chung & Frontend:** Nếu nghiệp vụ yêu cầu thay đổi file Frontend hoặc file dùng chung, phải **dừng lại và hỏi ý kiến người dùng** trước khi thực hiện.

## 2. Kiến Trúc & Công Nghệ Đặc Thù (Tech Stack)
* **Framework:** Sử dụng **NestJS** (TypeScript). Tuân thủ chặt chẽ kiến trúc Module, Controller, Service, Repository.
* **Database:** **PostgreSQL**. Sử dụng DTO để validate (`class-validator`), bảo đảm toàn vẹn dữ liệu.
* **Background Jobs:** Sử dụng **BullMQ + Redis** cho các tác vụ nặng (Gửi mail, Gemini AI CV Screening, PDF parsing).
* **Tuân thủ chuẩn mực:** Không tự ý refactor lan man ngoài phạm vi task. Tuân thủ strict typing của TypeScript (tránh dùng `any`).

## 3. Tính Tương Thích Của API
* **Bảo đảm tương thích:** Duy trì tính tương thích của API (RESTful), không tự ý thay đổi contract để tránh phá vỡ Frontend.
* **Hỏi trước khi đổi hợp đồng:** Phải hỏi ý kiến trước khi thay đổi endpoint, HTTP method, cấu trúc request payload (DTO) hoặc response format.

## 4. Bảo Mật, Xác Thực & Validate
* **Validation & Authorization:** Luôn validate đầu vào với `class-validator` / `class-transformer`. Thực hiện Auth Guard (JWT) và RBAC Guard cho từng endpoint.
* **Xử lý lỗi:** Sử dụng Exception Filters của NestJS để trả về mã lỗi chuẩn. Không để lộ stack trace ra ngoài.
* **Bảo mật:** Tuyệt đối không hard-code hoặc log secret keys, mật khẩu (`.env` ConfigService). Ngăn chặn SQL Injection thông qua ORM/QueryBuilder an toàn.

## 5. Cơ Sở Dữ Liệu & Migration
* **Quản lý qua Migration:** Mọi thay đổi schema (PostgreSQL) phải được thực hiện thông qua file migration chính thức của TypeORM/Prisma (tùy stack cụ thể).
* **Thao tác dữ liệu:** Quản lý giao dịch (Transactions) chặt chẽ bằng QueryRunner/Transaction khi có nhiều thao tác ghi.
* **Không phá hủy:** Tuyệt đối không `DROP TABLE`, `TRUNCATE` hoặc chạy lệnh xóa dữ liệu hàng loạt khi chưa có chỉ định rõ ràng.

## 6. Kiểm Thử & Báo Cáo
* **Chạy Lint & Test:** Luôn chạy lint (`npm run lint`) và unit/integration tests (`npm run test`) liên quan. Báo cáo nếu có lỗi do môi trường.
* **Tôn trọng mã nguồn chung:** Giữ nguyên code của người khác; kiểm tra kỹ diff trước khi hoàn thành.
* **Ghi chú & Log:** Đảm bảo audit log đầy đủ đối với các hành động quan trọng (tạo/sửa job, ứng tuyển). Báo cáo rõ danh sách file đã sửa.
