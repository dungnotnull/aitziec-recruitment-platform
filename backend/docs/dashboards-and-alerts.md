# ITZiec Platform Dashboards & Actionable Alerts (BE-7-011)

Tài liệu này định nghĩa hệ thống bảng điều khiển giám sát (Grafana Dashboards) và các cảnh báo hành động (Actionable Alerts) cho hạ tầng backend ITZiec theo tiêu chuẩn NFR-OBS-003–004.

---

## 1. Danh Sách Dashboard Giám Sát Cốt Lõi

1. **Dashboard 1: API Gateway & HTTP Traffic**
   - **Metrics:** `http_requests_total`, `http_request_duration_ms_sum`
   - **Views:** RPS (Requests Per Second), P50/P95/P99 Latency, Tỷ lệ lỗi 4xx vs 5xx theo từng endpoint (`/auth`, `/jobs`, `/applications`, `/cvs`, `/ai`, `/admin`).
2. **Dashboard 2: Cơ Sở Dữ Liệu PostgreSQL**
   - **Metrics:** `dependency_up{dependency="database"}`, Active Connection Count, Lock Waits, P95 Query Duration.
   - **Views:** Tải CPU/RAM của PostgreSQL, kích thước bảng `jobs`, `applications`, `audit_logs`, độ trễ giao dịch Outbox.
3. **Dashboard 3: Hàng Đợi & Workers (BullMQ / Redis)**
   - **Metrics:** `queue_depth`, `queue_active`, `queue_failed`, `dependency_up{dependency="redis"}`
   - **Views:** Độ sâu hàng đợi email, hàng đợi trích xuất CV, tỷ lệ retry và số job chuyển vào Dead Letter Queue (DLQ).
4. **Dashboard 4: AI & Machine Learning Services**
   - **Metrics:** Số lượng yêu cầu phân tích AI, tỷ lệ thành công/thất bại, thời gian phản hồi Gemini, số lượng request bị 429 Rate Limit.
5. **Dashboard 5: Lưu Trữ Đối Tượng (MinIO / S3)**
   - **Views:** Tỷ lệ thành công của Upload/Download CV PDF, băng thông I/O, thời gian tạo signed URL.

---

## 2. Ma Trận Cảnh Báo Hành Động (Actionable Alert Matrix)

| Tên Cảnh Báo | Điều Kiện Kích Hoạt | Mức Độ (Severity) | Kênh Thông Báo | Runbook Liên Kết |
| :--- | :--- | :--- | :--- | :--- |
| **ApiHigh5xxRate** | Tỷ lệ lỗi 5xx > 2% trong 5 phút | P1 - Critical | PagerDuty, Slack #ops-alerts | [Runbook: API 5xx Outage](file:///c:/Users/ROG/Downloads/Work/aitziec-recruitment-platform/backend/docs/operational-runbooks.md#1-api-5xx-high-error-rate) |
| **DatabaseDown** | `dependency_up{dependency="database"} == 0` trong 30s | P1 - Critical | PagerDuty, SMS | [Runbook: Database Outage](file:///c:/Users/ROG/Downloads/Work/aitziec-recruitment-platform/backend/docs/operational-runbooks.md#2-database-connectivity-outage) |
| **RedisDown** | `dependency_up{dependency="redis"} == 0` trong 30s | P1 - Critical | PagerDuty, Slack #ops-alerts | [Runbook: Redis Outage](file:///c:/Users/ROG/Downloads/Work/aitziec-recruitment-platform/backend/docs/operational-runbooks.md#3-redis--cache-outage) |
| **QueueBacklogHigh** | `queue_depth > 500` trong 10 phút | P2 - High | Slack #ops-alerts | [Runbook: Queue Backlog](file:///c:/Users/ROG/Downloads/Work/aitziec-recruitment-platform/backend/docs/operational-runbooks.md#4-queue-backlog--worker-saturation) |
| **AiProviderOutage** | Tỷ lệ lỗi AI Provider > 10% trong 5 phút | P2 - High | Slack #ai-alerts | [Runbook: AI Provider Outage](file:///c:/Users/ROG/Downloads/Work/aitziec-recruitment-platform/backend/docs/operational-runbooks.md#5-ai-provider-failure--rate-limit) |
| **DiskSpaceLow** | Dung lượng ổ đĩa khả dụng < 15% | P2 - High | Slack #ops-alerts | [Runbook: Storage & Disk Cleanup](file:///c:/Users/ROG/Downloads/Work/aitziec-recruitment-platform/backend/docs/operational-runbooks.md#6-storage--disk-space-recovery) |
