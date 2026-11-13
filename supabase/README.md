# Phần việc Supabase — Người 3

Chưa có migration trong nền mock. Khi triển khai bản thật:

- Tạo incidents/reports/history, liên kết nhiều reports vào một incident.
- Implement `IncidentRepository` bằng transaction phù hợp cho confirm, unique constraints và lưu kết quả idempotent.
- Implement `ImageStorage` bằng Supabase Storage; cấu hình URL/quyền đọc ảnh cho Mobile.
- Service-role key chỉ nằm ở backend.
- Kiểm tra dữ liệu còn sau restart backend và concurrent confirmations không tạo trùng.

Không dùng repository bộ nhớ làm bằng chứng cho tính an toàn transaction DB. Giữ module AI/matching mock để phát triển độc lập nếu cần.
