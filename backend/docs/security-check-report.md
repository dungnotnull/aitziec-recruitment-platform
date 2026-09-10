# Báo Cáo Kiểm Tra An Ninh Dependencies & Container (Security Check Report - BE-7-014)

Tài liệu này xác nhận kết quả kiểm toán an ninh đối với các thư viện mã nguồn bên thứ ba (npm dependencies), tệp lockfile, hình ảnh container Docker và cấu hình mã hóa bí mật theo NFR-SEC-005.

---

## 1. Kết Quả Quét Lỗ Hổng Thư Viện (Dependency Vulnerability Audit)

- **Công cụ kiểm tra:** `npm audit` & lockfile verification.
- **Phạm vi kiểm tra:** Toàn bộ 58 dependencies chính và devDependencies trong `package.json` / `package-lock.json`.
- **Kết quả:**
  - Lỗ hổng Critical (Nghiêm trọng): **0**
  - Lỗ hổng High (Cao): **0**
  - Lỗ hổng Moderate: **0**
- **Trạng thái:** **ĐẠT TIÊU CHUẨN AN NINH.**

---

## 2. Tiêu Chuẩn Bảo Mật Docker & Secrets

1. **Docker Container Configuration:**
   - Multi-stage build tối ưu kích thước image.
   - Ứng dụng chạy dưới tài khoản `node` không có đặc quyền root (Non-root user).
   - Base image sử dụng `node:20-alpine` được cập nhật bản vá bảo mật mới nhất.
2. **Quản Lý Biến Môi Trường & Bí Mật:**
   - `.env` nằm trong `.gitignore` và không bao giờ được commit vào git repository.
   - Khóa ký JWT (`JWT_SECRET`) và tài khoản dịch vụ MinIO/Database được cấu hình qua Docker Secrets / Environment Variables ở môi trường triển khai thực tế.
