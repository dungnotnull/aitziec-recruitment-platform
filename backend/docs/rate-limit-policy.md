# Chính Sách Giới Hạn Tần Suất Endpoint (Endpoint-Specific Rate Limit Policy - BE-7-012)

Tài liệu này quy định ngưỡng giới hạn tần suất yêu cầu (Rate Limiting) trên từng nhóm endpoint theo AUTH-006, AI-001 và NFR-SEC-005 nhằm bảo vệ hệ thống trước tấn công Brute-force, DoS và lạm dụng tài nguyên.

---

## 1. Ma Trận Hạn Mức Từng Endpoint

| Nhóm Endpoint | Đường dẫn API | Ngưỡng Giới Hạn | Định danh Giới Hạn | Xử Lý Khi Vượt Ngưỡng |
| :--- | :--- | :--- | :--- | :--- |
| **Xác thực (Auth)** | `POST /auth/login`, `POST /auth/register` | **10 requests / phút** | Theo IP Client + Email | Trả về `429 RATE_LIMITED` |
| **Tải lên hồ sơ (CV Upload)** | `POST /cvs` | **5 requests / phút** | Theo Candidate ID + IP | Trả về `429 RATE_LIMITED` |
| **Phân tích AI** | `POST /ai/cv-job-analyses` | **20 requests / phút** (100 req/ngày) | Theo User ID | Trả về `429 RATE_LIMITED` |
| **Tìm kiếm tự nhiên** | `POST /jobs/search/parse` | **60 requests / phút** | Theo IP Client | Fallback sang rule-based |
| **Duyệt tin việc làm** | `GET /jobs` | **120 requests / phút** | Theo IP Client | Trả về `429 RATE_LIMITED` |
| **Quản trị (Admin)** | `/admin/*` | **120 requests / phút** | Theo Admin ID | Trả về `429 RATE_LIMITED` |

---

## 2. Tiêu Chuẩn HTTP Response Headers

Mọi response từ các endpoint có áp dụng Rate Limit bắt buộc phải trả về các HTTP headers:
- `X-RateLimit-Limit`: Hạn mức tối đa được phép trong cửa sổ thời gian.
- `X-RateLimit-Remaining`: Số lượng request còn lại được phép gọi.
- `X-RateLimit-Reset`: Thời điểm (epoch timestamp) cửa sổ giới hạn được đặt lại.
- `Retry-After`: Số giây client cần chờ trước khi thử lại khi nhận mã lỗi 429.
