# Cài và kết nối iPhone với CivicMerge

Repo dùng Expo SDK 58. Code và bundle iOS đã có; các bước bên dưới cần chủ thiết bị/tài khoản thực hiện. Chưa có bản IPA được ký hoặc triển khai lên dịch vụ build.

## 1. Chuẩn bị client iOS

Đối chiếu ngày 13/11/2026: trang tải liệt kê [Expo Go SDK 58](https://expo.dev/go). [Hướng dẫn iOS chính thức](https://docs.expo.dev/get-started/set-up-your-environment/?platform=ios&device=physical&mode=expo-go) hiện yêu cầu Apple Developer Program còn hiệu lực, build Expo Go bằng `npx eas-cli@latest go`, cài TestFlight và thêm Apple ID làm internal tester trong App Store Connect. Thực hiện bằng tài khoản của nhóm; không nhập credential vào source code. Nếu nhóm chưa có tài khoản này, cần giải quyết điều kiện cài client trước nghiệm thu iPhone; chưa tự đăng ký hoặc mua dịch vụ.

Sau khi có client phù hợp, đăng nhập Expo CLI và Expo Go bằng cùng Expo account theo [hướng dẫn kết nối thiết bị](https://docs.expo.dev/get-started/start-developing/). Từ `apps/mobile/` chạy:

```sh
npx expo login
```

Trên PowerShell dùng `npx.cmd` nếu script `.ps1` bị chặn. Việc đăng nhập là thao tác tương tác của chủ tài khoản; không gửi mật khẩu/token qua chat.

Nếu muốn dùng development build riêng của CivicMerge thay Expo Go, cần một bước cấu hình signing/build riêng; chưa có trong bản nền này.

## 2. Kết nối laptop và iPhone

1. Cài dependency và tạo hai file `.env` theo README.
2. Laptop và iPhone cùng Wi-Fi; tìm IPv4 của laptop, ví dụ `192.168.1.20`.
3. Đặt `PUBLIC_BASE_URL` ở API và `EXPO_PUBLIC_API_URL` ở Mobile cùng là `http://192.168.1.20:3000`.
4. Chạy `npm run dev:api` từ root repo.
5. Mở Safari trên iPhone, vào `http://192.168.1.20:3000/health`. Phải có JSON status `ok`, mode `mock`.
6. Chạy `npm run dev:mobile` từ root; quét QR và mở bằng client đã cài.
7. Nếu iOS hỏi quyền mạng nội bộ, cho phép để truy cập laptop; camera và GPS chỉ được xin khi bạn chọn chức năng tương ứng.

`localhost` trên iPhone chỉ chính iPhone, không phải laptop. Nếu thấy danh sách nhưng ảnh không tải được, kiểm tra `PUBLIC_BASE_URL` của backend rồi reset dữ liệu và gửi lại ảnh để tạo URL đúng.

## 3. Kiểm tra lần đầu

- [ ] Trang chủ tải danh sách, không báo lỗi mạng.
- [ ] Chụp ảnh được; từ chối camera vẫn có thể dùng chọn ảnh.
- [ ] Chọn ảnh thư viện, kể cả định dạng iPhone thường dùng, gửi lên được sau chuẩn hóa JPEG.
- [ ] Cho phép GPS và lấy vị trí được; từ chối GPS không crash.
- [ ] Vị trí mẫu được ghi rõ là demo.
- [ ] Tạo hồ sơ đầu, gửi ảnh khác rồi hợp nhất, xem hai ảnh.
- [ ] Đóng/mở Mobile vẫn xem hồ sơ khi backend còn chạy.
- [ ] Thử chữ hệ thống lớn, VoiceOver, xoay ngang và vùng tai thỏ/home indicator.
- [ ] Hai điện thoại cùng backend chạy lại kịch bản một incident, hai reports.

## 4. Khi không kết nối được

| Hiện tượng | Kiểm tra |
|---|---|
| Safari không mở `/health` | Backend đang chạy, IP/port đúng, Wi-Fi không chặn kết nối giữa thiết bị; cho phép Node trên mạng riêng nếu Windows Firewall hỏi |
| Expo mở được nhưng API lỗi | Đường Expo/Metro và đường Express độc lập; kiểm tra lại URL API và `/health` |
| Thông báo Expo account | CLI và client đăng nhập cùng tài khoản |
| SDK không tương thích | Client phải hỗ trợ SDK 58; không tự downgrade dependency từng gói |
| Đổi `.env` nhưng vẫn gọi địa chỉ cũ | Khởi động lại Metro bằng `npm run dev:mobile -- --clear`, reload ứng dụng |
| Chỉ có một điện thoại thấy hồ sơ | Đảm bảo cả hai trỏ cùng backend, rồi tải lại danh sách |

Tunnel cho Expo không tự làm Express truy cập được. Nếu LAN bị chặn, cấu hình đường truy cập cho API và URL ảnh riêng hoặc dùng backend tích hợp qua Internet theo phương án nhóm.
