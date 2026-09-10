# Quy Trình CI/CD & Cổng Triển Khai An Toàn (CI/CD Deployment Gates - BE-7-023)

Tài liệu này xác định quy trình tự động hóa kiểm thử, di chuyển schema cơ sở dữ liệu và các cổng an toàn khi triển khai phiên bản backend mới theo NFR-TEST-004 và NFR-REL-004.

---

## 1. Các Cổng Kiểm Tra CI/CD Bắt Buộc (Pipeline Gates)

Mọi pull request hoặc commit lên nhánh chính bắt buộc phải vượt qua 5 cổng kiểm tra tuần tự:

```
[ 1. Linter & Type Check ] -> [ 2. Unit Tests (100% Pass) ] -> [ 3. E2E & Contract Tests ]
                                                                       │
[ 5. Production Rolling Deploy ] <- [ 4. DB Migration Deploy Gate ] <───┘
```

1. **Gate 1: Code Quality & Linter (`npm run lint`):**
   - 0 error ESLint / Prettier.
2. **Gate 2: Kiểm thử đơn vị (`npm test`):**
   - Chạy toàn bộ 20+ unit test suites, độ bao phủ logic cốt lõi.
3. **Gate 3: Kiểm thử tích hợp & Hợp đồng (`npm run test:e2e`):**
   - Kiểm chứng 100% ma trận phân quyền, hợp đồng API-CONTRACT và luồng tuyển dụng end-to-end.
4. **Gate 4: Cổng Di Chuyển Schema An Toàn (`npx prisma migrate deploy`):**
    - Chạy migration trước khi update code API.
    - Nguyên tắc: Chỉ áp dụng các thay đổi schema tương thích ngược (Additive changes only).
    - Quy trình xử lý sự cố migration lỗi: xem chi tiết tại `docs/phase-8-migration-verification.md` (`npx prisma migrate resolve --rolled-back` và `npx prisma migrate deploy`).
5. **Gate 5: Triển Khai Không Gián Đoạn (Zero-Downtime Rolling Update):**
    - Khởi động container phiên bản mới, kiểm tra `/health/ready` trả về 200 OK.
    - Khi container mới sẵn sàng, Traefik/Ingress chuyển hướng traffic và hủy dần container cũ.

---

## 2. Quy Trình Rollback Khẩn Cấp (Emergency Rollback)

Nếu sau khi triển khai phát hiện lỗi nghiêm trọng (tỷ lệ 5xx > 1%):
1. Chuyển ingress traffic ngay lập tức về hình ảnh container phiên bản ổn định trước đó (Image Tag trước).
2. Thời gian rollback tự động: **< 60 giây**.
3. Nếu migration thất bại, kích hoạt quy trình xử lý rollback theo `docs/phase-8-migration-verification.md`.
