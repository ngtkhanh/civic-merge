# Kết quả kiểm chứng nền mock — 13/11/2026

Branch: `chore/mock-foundation`. Node 24.21.0, npm 11.19.0, Expo SDK 58.

| Kiểm tra | Kết quả | Phạm vi |
|---|---|---|
| `npm run typecheck` | PASS | Workspace và scripts/tests |
| `npm run lint` | PASS | Mobile, bao gồm React Hooks rules |
| `npm run test:modules` | PASS | Fixtures/schema, AI/matching/routing độc lập |
| `npm run test:integration` | PASS, 5 ca | HTTP create/merge/retry, ảnh, validation, GPS denial, AI failure, reset, mock controls |
| `npm run mobile:export` | PASS | Expo Router + shared packages đóng gói iOS bằng Metro; không phải IPA |
| Khởi động `server.ts`, gọi `/health`, chạy CLI reset | PASS | Server tạm localhost, không mở backend Internet |
| Cài lại source sạch | PASS | Bản sao không node_modules/.env/cache; npm ci + typecheck + lint + modules + integration |
| iPhone thật | CHƯA XÁC MINH | Người dùng chưa cài client SDK 58 |
| Hai điện thoại cùng backend | CHƯA XÁC MINH | Chờ nghiệm thu thiết bị |
| Tích hợp vào main / push | CHƯA THỰC HIỆN | Chưa được yêu cầu |

## Review và giới hạn

- Đã tự rà soát input/output, pending → confirmed, kiểm tra merge khác loại, retry snapshot, clone dữ liệu bộ nhớ, URL ảnh và mock controls.
- Đã sửa lỗi module mode cho các script có top-level await và các lỗi React Hooks được lint phát hiện. Không tắt rule để che lỗi.
- Windows sandbox chặn `tsx` tại `os.userInfo()`; các test đã chạy trong môi trường được cấp quyền. Đây không phải lỗi nghiệp vụ.
- `npm audit`: 8 moderate trong chuỗi minimatch của Expo/fingerprint và TypeScript ESLint. `audit fix` không sửa được; không dùng `--force` để downgrade major Expo. Chưa xử lý dứt điểm cảnh báo dependency.
- Upload chỉ kiểm tra kích thước, MIME và chữ ký; chưa giải mã/kiểm tra toàn ảnh. Storage local chưa có retention tự động.
- Chưa xác minh giao diện 375pt, xoay ngang, chữ lớn, VoiceOver, camera/GPS hoặc quyền mạng iOS. Hướng dẫn thao tác: [IPHONE_SETUP.md](IPHONE_SETUP.md).
- Bộ nhớ không thay thế persistence/transaction của Supabase; mock AI/matching không chứng minh độ chính xác ảnh thật hoặc GPS.

Source sạch được kiểm tra bằng bản sao tạm của thay đổi hiện tại; chưa gọi đây là clone từ remote vì code chưa được push. Thư mục tạm kiểm chứng đã được dọn; dependency/cache/runtime không đưa vào commit.
