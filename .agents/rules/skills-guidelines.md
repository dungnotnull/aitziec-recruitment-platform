# Quy Định Kích Hoạt & Sử Dụng Agent Skills

Khi nhận bất kỳ câu lệnh (prompt) hoặc tác vụ nào từ người dùng, Agent **BẮT BUỘC** phải rà soát và kích hoạt các skill tương ứng nằm trong `.agents/skills/` bằng cách đọc file `SKILL.md` trước khi thực hiện:

## 1. Lập Kế Hoạch & Phân Tích Ý Tưởng
* **Ý tưởng tính năng mới, khảo sát yêu cầu:** Kích hoạt `brainstorming` (`.agents/skills/brainstorming/SKILL.md`).
* **Lập kế hoạch triển khai phức tạp:** Kích hoạt `writing-plans` (`.agents/skills/writing-plans/SKILL.md`).
* **Thực thi kế hoạch nhiều bước bằng subagent:** Kích hoạt `subagent-driven-development` (`.agents/skills/subagent-driven-development/SKILL.md`).
* **Phỏng vấn làm rõ thiết kế:** Kích hoạt `grill-me` hoặc `grill-with-docs`.

## 2. Thiết Kế UI / UX & Frontend
* **Thiết kế giao diện, phối màu, typography cao cấp:** Kích hoạt `ui-ux-pro-max` và `frontend-design`.
* **Hiệu ứng, chuyển động mượt mà:** Kích hoạt `micro-interactions-and-animations`.
* **Mobile-first & Responsive:** Kích hoạt `mobile-first-app-ui`.
* **Design system & Styling:** Kích hoạt `tailwind-design-system`.
* **Kiểm tra chất lượng & Tiêu chuẩn giao diện:** Kích hoạt `web-design-guidelines`.

## 3. Lập Trình & Tối Ưu Kiến Trúc
* **Kiến trúc component React:** Kích hoạt `vercel-composition-patterns`.
* **Hiệu năng & Best practices React / Web:** Kích hoạt `vercel-react-best-practices`.
* **Cải thiện và tái cấu trúc mã nguồn:** Kích hoạt `improve-codebase-architecture`.

## 4. Kiểm Thử, Debug & Tự Động Hóa
* **Viết code tính năng / sửa bug mới:** Bắt buộc tuân thủ `test-driven-development` (TDD).
* **Điều tra nguyên nhân gốc rễ lỗi:** Kích hoạt `systematic-debugging`.
* **Tự động hóa trình duyệt, test E2E UI:** Kích hoạt `agent-browser`.
