# Báo Cáo Kiểm Chứng Phục Hồi Và Triển Khai Migration Phase 8 (BE-8-003)

Tài liệu này ghi nhận bằng chứng kỹ thuật về việc sửa chữa migration `20260909000000_jobs_and_saved_jobs`, quy trình giải quyết lỗi `P3018`/`42P17`, và kiểm chứng khả năng triển khai liên tục trên PostgreSQL theo các tiêu chuẩn NFR-REL-004.

---

## 1. Bối Cảnh Lỗi & Nguyên Nhân Gốc Rễ

- **Lỗi ban đầu:** Migration `20260909000000_jobs_and_saved_jobs/migration.sql` sử dụng hàm `array_to_string("technologyNames", ' ')` trong mệnh đề `GENERATED ALWAYS AS (...) STORED` cho cột `search_vector`.
- **Nguyên nhân gốc rễ:** Trong PostgreSQL, hàm `array_to_string` không được đánh dấu là `IMMUTABLE` (mà là `STABLE` do phụ thuộc vào collation/representation của mảng). Do đó, PostgreSQL từ chối tạo cột generated với mã lỗi `42P17` (`generation expression is not immutable`), dẫn đến Prisma báo lỗi `P3018`.
- **Giải pháp xử lý không phá hủy (Non-destructive remediation):**
  1. Thay thế cột generated bằng cột `search_vector tsvector` thông thường.
  2. Tạo function `jobs_search_vector_update()` với trigger `BEFORE INSERT OR UPDATE OF "title", "technologyNames", "description", "requirements" ON "jobs"`.
  3. Cập nhật (backfill) dữ liệu hiện hữu bằng lệnh `UPDATE "jobs" SET "search_vector" = ...`.
  4. Duy trì GIN index `jobs_search_vector_gin_idx` phục vụ truy vấn toàn văn tối ưu.

---

## 2. Quy Trình Khôi Phục Trạng Thái Migration (Recovery Workflow)

Đối với môi trường cơ sở dữ liệu đã từng ghi nhận thất bại do migration trước đó:

```bash
# Bước 1: Đánh dấu rollback bản ghi migration bị lỗi trong bảng _prisma_migrations
npx prisma migrate resolve --rolled-back 20260909000000_jobs_and_saved_jobs

# Bước 2: Triển khai lại migration đã được sửa chữa
npx prisma migrate deploy
```

Kết quả:
- Command exit code: `0`.
- Bảng `_prisma_migrations` không còn bản ghi `failed_at`.
- Lần chạy `npx prisma migrate deploy` tiếp theo có tính idempotent (no-op), không gây lỗi.

---

## 3. Kiểm Chứng Schema & Đối Tượng PostgreSQL

Sau khi triển khai migration sạch:

1. **Bảng `jobs` và `saved_jobs`:**
   - Khóa chính, ràng buộc ngoại `companyId` -> `companies(id)` và `candidateProfileId` -> `candidate_profiles(id)` tồn tại đầy đủ.
2. **Trigger `jobs_search_vector_trigger`:**
   - Truy vấn `information_schema.triggers` và `pg_trigger` xác nhận trigger `jobs_search_vector_trigger` đã được gắn vào bảng `jobs` cho các sự kiện `INSERT` và `UPDATE`.
3. **GIN Index `jobs_search_vector_gin_idx`:**
   - Truy vấn `pg_indexes` xác nhận index loại `GIN` trên biểu thức `search_vector` tồn tại và sẵn sàng tối ưu hóa tìm kiếm.
4. **Bảo toàn dữ liệu:**
   - Không sử dụng các lệnh phá hủy như `DROP TABLE`, `TRUNCATE`, hay `migrate reset`. Toàn bộ dữ liệu của người dùng được giữ nguyên vẹn.

---

## 4. Kết Luận
Migration đã được sửa chữa hoàn toàn, bảo đảm tương thích tuyệt đối với PostgreSQL 16 và hệ thống CI/CD deployment gates.
