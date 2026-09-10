# Kiến Trúc Triển Khai Production (Production Deployment Topology - BE-7-022)

Tài liệu này xác định mô hình kiến trúc mạng, cụm dịch vụ và cấu hình triển khai hạ tầng sản xuất của ITZiec Backend theo NFR-SEC-002–003.

---

## 1. Sơ Đồ Kiến Trúc Đa Tầng (Multi-Tier Architecture)

```
[ Internet / Cloudflare CDN & WAF (DDoS Mitigation, SSL Offload) ]
                         │
                         ▼
        [ Ingress / Traefik Reverse Proxy ]
                         │
        ┌────────────────┴────────────────┐
        ▼                                 ▼
[ NestJS API Nodes (3x) ]     [ BullMQ Background Workers (2x) ]
(Stateless API Endpoints)      (Async CV, Email, Outbox Jobs)
        │                                 │
        ├─────────────────────────────────┤
        ▼                                 ▼
┌──────────────────┐             ┌──────────────────┐
│  Redis Cluster   │             │ PostgreSQL 16 HA │
│ (Cache, Queues,  │             │ (Primary/Replica,│
│  Rate Limiting)  │             │  PgBouncer Pool) │
└──────────────────┘             └──────────────────┘
        │                                 │
        ▼                                 ▼
┌──────────────────┐             ┌──────────────────┐
│ MinIO/S3 Storage │             │ Google Gemini AI │
│ (Private Bucket, │             │ (Stateless API,  │
│  Presigned URLs) │             │  No Training)    │
└──────────────────┘             └──────────────────┘
```

---

## 2. Tiêu Chuẩn Bảo Mật Mạng (Network & Secrets Isolation)

1. **VPC & Private Subnets:**
   - Database PostgreSQL và Redis chỉ lắng nghe trong mạng nội bộ (Private VPC Subnet), không gán Public IP.
2. **Quản Lý Bí Mật (Secrets Management):**
   - Không lưu secret vào git hoặc build image.
   - Inject động qua HashiCorp Vault hoặc AWS Secrets Manager / Docker Swarm Secrets khi container khởi động.
3. **Mã Hóa Đường Truyền & Nghỉ (Encryption in Transit & at Rest):**
   - Toàn bộ kết nối nội bộ giữa API, Redis và DB bắt buộc bật TLS 1.3.
   - Cơ sở dữ liệu và bucket lưu trữ MinIO được bật mã hóa AES-256 at-rest.
