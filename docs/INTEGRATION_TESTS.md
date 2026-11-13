# Kiểm thử và nghiệm thu nền mock

## Kiểm tra tự động

Chạy từ root: `npm run typecheck`, `npm run lint`, `npm run test:modules`, `npm run test:integration`, `npm run mobile:export`.

`tests/integration/pipeline.test.ts` kiểm tra qua HTTP thật trên port ngẫu nhiên:

- Analyze không tạo incident; create rồi merge cho một incident với hai reports/ảnh đọc được.
- Confirm song song cùng report không nhân đôi; retry giữ kết quả ban đầu.
- Khác loại không xuất hiện trong candidates; merge khác loại hoặc đích không tồn tại không làm mất pending report.
- Thiếu GPS vẫn tạo mới; AI lỗi không lưu ảnh; input tọa độ, loại và giới hạn upload bị kiểm tra.
- Reset thay đổi repository đang chạy và cho phép replay.
- Mock controls không tồn tại khi app không ở mock mode.

Typecheck bao gồm cả tooling/tests. iOS export kiểm tra Metro/shared imports; không thay kiểm tra native hoặc thiết bị.

## Nghiệm thu thủ công còn cần thực hiện

Theo [hướng dẫn iPhone](IPHONE_SETUP.md): camera, photo picker, GPS cho phép/từ chối, quyền mạng, hiển thị ảnh qua LAN, chữ lớn, VoiceOver và xoay màn hình. Chưa đánh dấu PASS các mục này.

Hai điện thoại phải cùng backend. Tạo một incident từ điện thoại 1; điện thoại 2 gửi ảnh khác và merge; tải lại trên cả hai, kiểm tra hai minh chứng trong cùng hồ sơ. Restart Mobile không làm mất dữ liệu khi backend còn chạy.

Sau khi có Supabase: bổ sung nghiệm thu restart backend, transaction và concurrent merge trong DB. Sau khi có Vision/matching thật: kiểm tra ảnh thật và vị trí gần/xa; mock không chứng minh độ chính xác thuật toán.
