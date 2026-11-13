# APK Android cài trực tiếp

APK chứa ứng dụng CivicMerge và JavaScript/assets đã đóng gói. Người nhận mở APK để cài, không cần Expo Go hoặc Metro. Backend Express/PostgreSQL vẫn chạy riêng; điện thoại cần truy cập được địa chỉ backend đó.

## Bản build đã có — 14/11/2026

- EAS build `c3a8cd3c-7599-4bda-977b-61a76e00c7d9`: **FINISHED**, profile `preview`, Android version code 1, package `vn.civicmerge.demo`.
- [Tải APK](https://expo.dev/artifacts/eas/avz9WVhn8eMBrHuDVLLo6uuDxUVugt47agCS5JrJnV4.apk).
- File local: `.runtime/artifacts/CivicMerge-preview.apk` (gitignored), 91,996,506 bytes, SHA-256 `8bb4d17b69aca7f6a27f43bb37e5a6d3aa5aee213679771de41510f99297d792`.
- Kiểm tra archive có AndroidManifest/DEX, package đúng và signing block. Chưa kiểm tra cài APK trên điện thoại thật; kiểm tra signing block không phải kiểm chứng chữ ký bằng Android SDK.
- Supabase đã kết nối với TLS xác minh, migration đã chạy, API local đọc được database. Người dùng xác nhận `/health` mở được trên Chrome Android cùng Wi-Fi.
- Backend hiện đã chạy. Sau khi khởi động lại laptop có thể mở `.runtime/StartBackend.cmd`; giữ cửa sổ mở khi dùng app. Địa chỉ LAN lấy từ `PUBLIC_BASE_URL` trong file local, không phải tên miền FPT.

## Tạo APK

Repo đã có:

- `apps/mobile/eas.json`: profile `preview`, APK release/internal, `developmentClient=false`, Node 24.21.0.
- Android package `vn.civicmerge.demo`, version code 1. Đây là định danh bản demo; cần giữ signing key để cài bản cập nhật cùng package.
- Plugin `expo-build-properties` đúng SDK 58 bật HTTP cho backend LAN trong bản demo. Chưa thiết kế cấu hình phát hành production.
- Ô nhập/lưu địa chỉ backend ngay trên Trang chủ. APK không cần đóng gói IP laptop cố định.
- Preview luôn ghi rõ AI/matching giả lập; không hiển thị/gọi reset hoặc đổi scenario, dùng được với backend PostgreSQL hoặc memory chạy scenario mặc định.

Máy cần Node 24.21.0/npm 11.19.0. Chạy từ root repo:

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run mobile:export:android
```

`mobile:export:android` chỉ kiểm tra bundle, **không tạo APK**.

Nếu chưa có tài khoản, tạo tại https://expo.dev/signup. Sau đó đăng nhập bằng terminal riêng; không gửi mật khẩu/token qua chat:

```powershell
Set-Location apps/mobile
npx.cmd eas-cli@latest login
```

Sau khi đăng nhập, từ root repo chạy:

```powershell
npm.cmd run mobile:apk
```

Lần đầu EAS có thể yêu cầu tạo/liên kết project thuộc tài khoản của bạn và tạo Android keystore. Dùng keystore của nhóm và giữ lại để cập nhật app. Không commit credential hoặc keystore. Không cần chạy `build:configure` để ghi đè profile đã có. Nếu CLI yêu cầu kiểm tra thiết lập project, giữ profile `preview` hiện tại.

Build thành công sẽ trả link tải **`.apk`**. Tải về rồi gửi file/link cho điện thoại Android; mở file và cho phép ứng dụng tải file cài đặt ứng dụng từ nguồn đó khi Android hỏi. Hoặc dùng `adb install <path-to-apk>` nếu đã cấu hình USB debugging. Không cần tài khoản Google Play để cài bản APK trực tiếp.

Build native EAS đã hoàn tất và đã tải APK; việc cài/chạy trên thiết bị vẫn cần kiểm tra riêng. Máy hiện chưa có Android SDK và chỉ có Java 25; chưa chuẩn bị toolchain native Android local. EAS cloud là đường build được sử dụng.

## Chạy backend cho APK

Laptop và điện thoại cùng Wi-Fi nếu dùng LAN. Tìm IPv4 Wi-Fi bằng `ipconfig`, ví dụ `192.168.1.20`. Tạo `apps/api/.env` từ `.env.example` nếu chưa có, không ghi đè cấu hình sẵn có:

```dotenv
PORT=3000
HOST=0.0.0.0
PUBLIC_BASE_URL=http://192.168.1.20:3000
MOCK_MODE=true
PERSISTENCE_MODE=memory
```

Memory chạy được không cần credential, dữ liệu mất khi restart backend. Để lưu PostgreSQL, đổi `PERSISTENCE_MODE=postgres`, cấu hình `DATABASE_URL` riêng và chạy `npm run db:migrate` theo [hướng dẫn database](../supabase/README.md). AI/matching vẫn mock ở cả hai chế độ. Không đưa database password/service-role/OpenAI key vào APK.

Chạy `npm.cmd run dev:api`. Mở `http://192.168.1.20:3000/health` trên Chrome Android trước; phải có JSON `status=ok`. Nếu chưa được, kiểm tra Wi-Fi, IP, backend và Windows Firewall.

Mở APK → Trang chủ → **Kết nối máy chủ** → nhập `http://192.168.1.20:3000` → **Lưu và kết nối**. Địa chỉ được lưu riêng trên điện thoại; đổi IP thì sửa ở đây, không cần build APK mới. `localhost` trên Android trỏ chính điện thoại. Nếu dùng IP LAN, backend chỉ truy cập được khi cùng mạng; dùng từ mạng khác cần backend/URL ảnh truy cập được qua Internet, chưa triển khai trong chặng này.

`PUBLIC_BASE_URL` phải đúng để URL ảnh có thể mở từ điện thoại. Đổi địa chỉ kết nối trên APK không tự sửa URL ảnh đã lưu trước đó. Không reset database thật; cần xử lý chuyển URL ảnh riêng nếu đổi host lâu dài.

## Kiểm tra trên Android thật (chưa nghiệm thu)

- Cài và mở APK khi không có Expo Go/Metro.
- Lưu địa chỉ backend, đóng/mở app và kiểm tra còn địa chỉ.
- Camera, thư viện ảnh, GPS và từ chối quyền hoạt động đúng.
- Ảnh 1 tạo incident; ảnh 2 cùng vị trí/type được gợi ý và người dùng xác nhận merge; chi tiết có 2 reports/2 ảnh.
- Backend PostgreSQL không bị gọi `/api/mock/scenario` trước analyze và không có nút reset.
- Hai điện thoại cùng trỏ một backend thấy cùng incident sau khi tải lại.

Tài liệu chính thức: [Build APK](https://docs.expo.dev/build-reference/apk/), [monorepo](https://docs.expo.dev/build-reference/build-with-monorepos/), [SDK 58 BuildProperties](https://docs.expo.dev/versions/v58.0.0/sdk/build-properties/).
