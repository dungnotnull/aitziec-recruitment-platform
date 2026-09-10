# Chính Sách Bảo Mật, Lưu Trữ và Dữ Liệu Nhà Cung Cấp AI (AI Privacy, Retention & Provider Policy)

Tài liệu này xác định các quy tắc bảo vệ dữ liệu, quyền riêng tư, cơ chế ẩn danh hóa (PII Redaction), chính sách lưu trữ (retention) và thiết lập nhà cung cấp AI (Google Gemini / LLM Provider) trong nền tảng Tuyển dụng ITZiec theo các chuẩn mực AI-001–009, NFR-SEC-003–004 và BEI-003.

---

## 1. Nguyên Tắc Cốt Lõi (Core Principles)

1. **AI Hoàn Toàn Mang Tính Cố Vấn (Advisory Only - AI-009):**
   - Kết quả phân tích AI (điểm số, gợi ý, kỹ năng trùng khớp) KHÔNG BAO GIỜ tự động thay đổi trạng thái đơn ứng tuyển (không tự động từ chối hoặc chuyển vòng phỏng vấn).
   - Mọi quyết định tuyển dụng thuộc về nhà tuyển dụng con người (Human-in-the-loop).

2. **Bảo Vệ Thông Tin Định Danh Cá Nhân (PII Redaction - NFR-SEC-004):**
   - Trước khi gửi văn bản CV tới nhà cung cấp AI bên ngoài, các trường dữ liệu định danh nhạy cảm phải được phát hiện và làm sạch (redact).
   - Danh sách trường làm sạch: Số điện thoại, Số CCCD/CMND/Hộ chiếu, Địa chỉ nhà chi tiết, Đường dẫn mạng xã hội cá nhân riêng tư.
   - Chỉ giữ lại thông tin liên quan đến chuyên môn: Tên, Kỹ năng công nghệ, Quá trình học tập/Bằng cấp, Kinh nghiệm làm việc, Dự án, Chứng chỉ.

3. **Bảo Mật Prompt và Thông Tin Xác Thực (Zero Secret Leakage - AI-007, AI-008):**
   - API Key của AI Provider tuyệt đối không log ra console, audit log hay trả về client.
   - Raw Prompt, Raw Context và Raw CV Text không bao giờ được trả về trong response công khai của API nhằm bảo vệ tài sản trí tuệ và quyền riêng tư ứng viên.
   - Response chỉ trả về kết quả cấu trúc chuẩn hóa: `overallScore`, `components`, `matchedSkills`, `missingSkills`, `unmetRequirements`, `suggestions`, `limitations`.

4. **Cấu Hình Nhà Cung Cấp Dịch Vụ (Provider Settings - AI-001):**
   - Sử dụng cờ không huấn luyện dữ liệu người dùng (`zero data retention for model training` / API terms bảo mật doanh nghiệp).
   - Xử lý dạng stateless/ephemeral: Nhà cung cấp xử lý request và không lưu trữ CV của ứng viên vào bộ nhớ cache dài hạn hoặc tập dữ liệu training.

---

## 2. Ma Trận Dữ Liệu Truyền Tải và Lưu Trữ (Data Transmission & Storage Matrix)

| Loại dữ liệu | Dữ liệu gốc trong hệ thống | Được gửi tới AI Provider? | Lưu trữ trong DB (`ai_analyses`)? | Trả về API Client? |
| :--- | :--- | :--- | :--- | :--- |
| **Họ và tên ứng viên** | Lưu tại `candidate_profiles` | Có (để đánh giá ngữ cảnh) | Không (chỉ lưu ID liên kết) | Có (qua API profile riêng) |
| **Email, Điện thoại, Địa chỉ** | Lưu tại `users` / `cvs` | **KHÔNG** (bị Redact trước khi gửi) | **KHÔNG** | Không trong AI API |
| **Số CCCD / CMND** | Trong file đính kèm | **KHÔNG** (bị Redact) | **KHÔNG** | **KHÔNG** |
| **Kỹ năng & Chuyên môn** | Trích xuất từ CV | Có | Có (`matchedSkills`, `missingSkills`) | Có |
| **Kinh nghiệm làm việc** | Trích xuất từ CV | Có (sau khi chuẩn hóa) | Có (`components.EXPERIENCE`) | Có (dạng điểm & nhận xét) |
| **Yêu cầu công việc (JD)** | Lưu tại `jobs` | Có | Không (chỉ lưu `jobId`) | Có (qua Job API) |
| **Raw System Prompt** | Cấu hình mã nguồn | Có (nội bộ gửi tới AI) | Không | **KHÔNG BAO GIỜ** |
| **Raw AI Response / Reasoning** | Từ AI output | Nhận về từ AI | Không (chỉ lưu JSON đã validate) | Không |
| **Điểm và Đánh giá chuẩn hóa** | Tính toán từ AI | Không | Có (`overallScore`, `components`) | Có |

---

## 3. Chính Sách Thời Hạn Lưu Trữ (Retention Policy)

1. **Kết quả Phân tích AI (`ai_analyses`):**
   - Lưu trữ cùng vòng đời của CV và Đơn ứng tuyển.
   - Nếu CV bị xóa vĩnh viễn (Hard Delete khi chưa nộp đơn), các bản ghi `ai_analyses` liên kết trực tiếp sẽ bị xóa theo (Cascade Delete).
   - Nếu ứng viên yêu cầu xóa tài khoản theo chính sách quyền riêng tư (Right to be Forgotten), kết quả phân tích AI sẽ được xóa hoặc ẩn danh hóa hoàn toàn.
2. **Trạng thái Xử lý Bất đồng bộ (`operations`):**
   - Các bản ghi `Operation` (trạng thái hàng đợi tiến trình trích xuất/phân tích) được lưu giữ trong vòng **30 ngày** để phục vụ tra cứu và kiểm tra lỗi.
   - Sau 30 ngày, hệ thống định kỳ xóa các bản ghi `Operation` đã hoàn thành (`SUCCEEDED` hoặc `FAILED`).

---

## 4. Quản Lý Phiên Bản và Khả Năng Tái Lập (Model & Prompt Provenance)

Mỗi bản ghi phân tích `AiAnalysis` bắt buộc phải lưu kèm metadata kiểm toán:
- `model`: Định danh model được sử dụng (ví dụ: `gemini-1.5-flash` hoặc `gemini-stub-v1`).
- `promptVersion`: Phiên bản prompt bất biến (ví dụ: `cv_job_match_v1.0`).
- `schemaVersion`: Phiên bản JSON schema xác thực output (ví dụ: `v1.0`).
Điều này đảm bảo mọi kết quả phân tích đều có thể giải thích, kiểm toán và đối chiếu ngược lại khi cần thiết.
