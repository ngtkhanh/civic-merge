# Ảnh kiểm thử

Bốn PNG trong thư mục này được tạo bằng `node scripts/generate-fixtures.mjs` từ các hình học đơn giản do dự án tự định nghĩa. Đây là ảnh tổng hợp dùng kiểm tra upload và hiển thị; không phải ảnh sự cố thật hoặc dữ liệu kiểm chứng Vision.

- `pothole-1.png`, `pothole-2.png`: hai minh họa khác nhau cho kịch bản merge.
- `trash.png`, `flood.png`: kịch bản khác loại.

Ở mock mode, scenario do backend điều khiển; nội dung ảnh không quyết định kết quả AI. Khi nối Vision thật, Người 2 bổ sung ảnh thật được phép sử dụng để kiểm tra độ chính xác.
