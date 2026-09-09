# Sổ Tay Vận Hành & Xử Lý Sự Cố (Operational Runbooks - BE-7-024)

Tài liệu này cung cấp hướng dẫn xử lý từng bước cho kỹ sư vận hành khi xảy ra sự cố production theo tiêu chuẩn NFR-OBS-003–004.

---

### 1. API 5xx High Error Rate
- **Triệu chứng:** Cảnh báo `ApiHigh5xxRate` kích hoạt, người dùng gặp lỗi 500 khi gọi API.
- **Các bước xử lý:**
  1. Kiểm tra log tập trung để xác định endpoint bị lỗi: `docker logs --tail 200 -f itziec-api | grep ERROR`.
  2. Nếu do lỗi database connection pool bị cạn: Tăng `DATABASE_POOL_SIZE` hoặc khởi động lại PgBouncer.
  3. Nếu do bug phiên bản vừa deploy: Thực thi ngay [Quy trình Rollback](file:///c:/Users/ROG/Downloads/Work/aitziec-recruitment-platform/backend/docs/cicd-deployment-gates.md#2-quy-trình-rollback-khẩn-cấp-emergency-rollback).

### 2. Database Connectivity Outage
- **Triệu chứng:** Cảnh báo `DatabaseDown`, endpoint `/health/ready` trả về 503 Service Unavailable.
- **Các bước xử lý:**
  1. Kiểm tra trạng thái service PostgreSQL: `docker compose ps postgres` hoặc `systemctl status postgresql`.
  2. Kiểm tra dung lượng ổ đĩa: `df -h`. Nếu ổ đĩa đầy do WAL log, thực thi dọn dẹp phân vùng lưu trữ.
  3. Nếu node chính bị hỏng phần cứng: Kích hoạt chuyển đổi dự phòng sang Standby Replica (Failover).

### 3. Redis / Cache Outage
- **Triệu chứng:** Cảnh báo `RedisDown`, tính năng rate limit hoặc background queue bị gián đoạn.
- **Các bước xử lý:**
  1. Kiểm tra tiến trình Redis: `docker compose ps redis` hoặc `redis-cli ping`.
  2. Kiểm tra bộ nhớ RAM khả dụng: `free -m`. Nếu Redis bị OOM, cấu hình lại chính sách đuổi key `maxmemory-policy volatile-lru`.
  3. Khởi động lại Redis container: `docker compose restart redis`.

### 4. Queue Backlog & Worker Saturation
- **Triệu chứng:** Cảnh báo `QueueBacklogHigh`, email hoặc tiến trình trích xuất CV bị chậm.
- **Các bước xử lý:**
  1. Mở BullMQ Dashboard / Arena để quan sát số lượng job đang chờ (waiting) và thất bại (failed).
  2. Scale tăng số lượng worker instance: `docker compose up -d --scale worker=4`.
  3. Xem xét các job thất bại trong Dead Letter Queue (DLQ), kiểm tra nguyên nhân và bấm Retry khi downstream đã ổn định.

### 5. AI Provider Failure & Rate Limit
- **Triệu chứng:** Cảnh báo `AiProviderOutage`, các yêu cầu phân tích CV/JD trả về lỗi hoặc timeout.
- **Các bước xử lý:**
  1. Kiểm tra trạng thái Google Cloud Gemini status dashboard.
  2. Nếu bị HTTP 429 Quota Exceeded: Tăng hạn mức quota trên Google Cloud Console hoặc chuyển đổi sang API Key phụ (Key Rotation).
  3. Tạm thời bật chế độ heuristic fallback để không làm tắc nghẽn trải nghiệm của người dùng.

### 6. Storage & Disk Space Recovery
- **Triệu chứng:** Dung lượng ổ đĩa khả dụng < 15%.
- **Các bước xử lý:**
  1. Xóa các tệp log cũ quá 30 ngày: `find /var/log/itziec/ -name "*.log" -mtime +30 -delete`.
  2. Dọn dẹp Docker images không dùng: `docker system prune -f`.
  3. Chạy script dọn dẹp các bản ghi `operations` cũ theo chính sách lưu trữ [data-retention-and-deletion-policy.md](file:///c:/Users/ROG/Downloads/Work/aitziec-recruitment-platform/backend/docs/data-retention-and-deletion-policy.md).
