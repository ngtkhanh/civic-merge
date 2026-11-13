# Bàn giao kỹ thuật — Nền mock

## 1. Approach & Reasoning

Giữ HTTP thật và repository có trạng thái để kiểm tra được toàn bộ create/merge; mock phần AI/matching để bốn người có thể làm độc lập.

## 2. Roads Not Taken

Không dùng JSON cố định cho mọi API vì không thể hiện trạng thái sau confirm. Không triển khai backend Internet ngay vì nhóm đã chọn local trước.

## 3. How Things Connect

Mobile → Express → AI/matching → pending report; confirm → routing/repository → incident và history. Contracts dùng chung tại boundary, implementation thay tại bootstrap.

## 4. Tools & Methods

Typecheck, lint, 5 ca HTTP integration, module fixtures và Metro iOS export đều qua. Source sạch cài lại bằng npm ci và chạy kiểm tra thành công. Chưa thao tác thiết bị thật.

## 5. Tradeoffs

Bộ nhớ giúp reset nhanh nhưng mất dữ liệu khi restart. Matching cố định giúp demo tái lập nhưng không kiểm chứng khoảng cách/độ chính xác.

## 6. Mistakes & Dead Ends

Script ESM ban đầu thiếu type:module; đã sửa. Lint phát hiện state thay đổi trong effect và đọc ref khi render; chuyển dữ liệu render sang state và cập nhật loading từ sự kiện retry. Không xử lý lỗi quyền os.userInfo của sandbox bằng thay đổi nghiệp vụ.

## 7. Future Pitfalls

Snapshot confirm có thể cũ hơn số report hiện tại; cần đọc detail. Ảnh local cũ còn sau reset. Client iOS SDK 58 cần chuẩn bị theo tài liệu Expo hiện tại; chưa có tài khoản signing/build được sử dụng.

## 8. Expert vs Beginner

Typecheck và bundle không kiểm chứng camera/GPS/quyền mạng. Repository bộ nhớ cũng không chứng minh DB transaction an toàn.

## 9. Transferable Lessons

Tách contract khỏi implementation, kiểm tra invariants bằng HTTP có trạng thái, và ghi rõ kiểm chứng tự động so với kiểm chứng thiết bị giúp bàn giao module độc lập.
