# Chiến Lược Sao Lưu & Khôi Phục Dữ Liệu (Backup & Recovery Strategy - BE-7-019)

Tài liệu này xác định quy trình tự động sao lưu cơ sở dữ liệu PostgreSQL và đối tượng lưu trữ MinIO/S3 có mã hóa theo tiêu chuẩn NFR-REL-004.

---

## 1. Lịch Trình Sao Lưu Định Kỳ

1. **Cơ Sở Dữ Liệu PostgreSQL:**
   - **Full Backup:** Thực hiện hàng ngày vào lúc 02:00 UTC bằng tiện ích `pg_dump`.
   - **WAL Archiving (Point-in-Time Recovery):** Ghi nhận liên tục các file WAL lưu trữ sang storage riêng biệt để hỗ trợ phục hồi tới từng giây.
   - **Mã hóa:** Tệp sao lưu được nén `gzip` và mã hóa bằng AES-256 (`gpg --symmetric`).
2. **Đối Tượng File MinIO / S3:**
   - Bucket `itziec-cvs` được cấu hình tính năng Versioning và Object Lock (WORM - Write Once Read Many).
   - Đồng bộ sang bucket dự phòng thứ cấp (Cross-Region Replication).

---

## 2. Lệnh Sao Lưu Tự Động (Script Mẫu)

```bash
#!/usr/bin/env bash
set -eo pipefail

BACKUP_DATE=$(date -u +"%Y%m%d_%H%M%SZ")
BACKUP_FILE="/backups/itziec_db_${BACKUP_DATE}.sql.gz.enc"

echo "Starting encrypted PostgreSQL backup..."
pg_dump -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" --no-owner --clean \
  | gzip \
  | openssl enc -aes-256-cbc -salt -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY -out "${BACKUP_FILE}"

echo "Backup created successfully: ${BACKUP_FILE}"
```
