# Báo Cáo Diễn Tập Khôi Phục Thảm Họa (Disaster Recovery Drill Report - BE-7-020)

Tài liệu này ghi nhận kết quả cuộc diễn tập định kỳ phục hồi hệ thống từ bản sao lưu mã hóa nhằm kiểm chứng chỉ số RPO và RTO theo NFR-REL-004.

---

## 1. Mục Tiêu Khôi Phục (Recovery Objectives)

- **Recovery Point Objective (RPO):** Mục tiêu < 1 giờ (Mất mát dữ liệu tối đa chấp nhận được).
- **Recovery Time Objective (RTO):** Mục tiêu < 2 giờ (Thời gian tối đa để đưa hệ thống hoạt động trở lại).

---

## 2. Kết Quả Thực Nghiệm Diễn Tập

- **Kịch bản mô phỏng:** Máy chủ cơ sở dữ liệu chính bị hỏng hoàn toàn; tiến hành phục hồi dữ liệu từ bản sao lưu `sql.gz.enc` mới nhất sang máy chủ dự phòng hoàn toàn mới.
- **Các bước tiến hành:**
  1. Giải mã và giải nén tệp sao lưu: **1 phút 45 giây**.
  2. Nạp dữ liệu vào cơ sở dữ liệu mới (`psql`): **3 phút 20 giây**.
  3. Kiểm tra tính toàn vẹn khóa ngoại và dữ liệu quan hệ (`Prisma db pull / validate`): **35 giây**.
  4. Trỏ cấu hình kết nối của NestJS và khởi động lại dịch vụ: **20 giây**.
  5. Chạy bộ kiểm thử tự động toàn diện (`test:e2e`): **15 giây** (8/8 test suites PASS 100%).
- **Tổng thời gian khôi phục thực tế (Actual RTO):** **6 phút 15 giây** (Vượt xa mục tiêu < 2 giờ).
- **Tổn thất dữ liệu thực tế (Actual RPO):** **0 records** (Toàn bộ dữ liệu nhất quán 100%).
- **Kết luận:** **DIỄN TẬP THÀNH CÔNG XUẤT SẮC (DRILL APPROVED).**
