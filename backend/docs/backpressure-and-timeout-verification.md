# Xác Minh Cơ Chế Timeout & Backpressure (Timeout & Backpressure Verification - BE-7-017)

Tài liệu này xác nhận hành vi của hệ thống khi gặp tình trạng bão hòa tải, quá hạn xử lý (timeout) và cơ chế giảm tải (backpressure) theo NFR-PERF-004 và NFR-REL-003.

---

## 1. Cơ Chế Giảm Tải Hàng Đợi (Queue Backpressure)

1. **Kiểm Soát Tải Đồng Thời Worker:**
   - Worker xử lý trích xuất CV và gửi email được giới hạn số job xử lý song song (`concurrency: 5`).
   - Khi số lượng job vượt ngưỡng, BullMQ lưu trữ an toàn trong hàng đợi Redis và không làm nghẽn CPU/RAM của tiến trình API.
2. **Cơ Chế Khôi Phục Không Mất Mát Dữ Liệu (Zero Lost Work):**
   - Sự kiện domain được ghi nhận nguyên khối trong bảng `outbox_events`.
   - Ngay cả khi worker bị crash hoặc restart, worker sẽ tự động re-fetch và xử lý lại các job dang dở khi khởi động lại.

---

## 2. Kiểm Soát Timeout & Tải AI Bão Hòa

1. **Timeout Phản Hồi:**
   - Mọi request gọi sang Gemini AI được bao bọc bởi `AbortController` với thời hạn tối đa 8 giây.
   - Nếu quá hạn 8s, kết nối tự động hủy để giải phóng tài nguyên.
2. **Bảo Vệ Quota Bão Hòa:**
   - Khi đạt giới hạn 10 request đồng thời hoặc 100 request/ngày/user, hệ thống trả về mã lỗi chuẩn `429 RATE_LIMITED` ngay lập tức, giữ vững tính khả dụng của API cho toàn bộ người dùng khác.
