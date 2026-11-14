# Bàn giao Mobile/APK — chặng demo readiness

Nhánh `feature/demo-readiness` dựa trên backend `32f1854`. Người dùng đã cho phép lưu phần Mobile đang có và sửa lỗi tương thích cần thiết, không thiết kế lại UI, không triển khai OTA/FPT hoặc viết thay AI/matching.

**Cập nhật tích hợp 14/11:** đã tiếp nhận sáu file UI của Người 1 trên `main` (`a5258a7`), giữ ô đổi URL, phân loại lỗi/retry và tải candidate độc lập. Nhãn AI/matching lấy từ health capabilities, không suy khoảng cách thật từ build flag; reset/scenario chỉ bật khi health xác nhận memory/local/mock/mock và build cho phép. `INCIDENT_RESOLVED` 409 mở lại lựa chọn. Chưa build/cài APK mới hoặc nghiệm thu thiết bị. Báo cáo chặng cũ bên dưới giữ làm lịch sử; kết quả mới ở [merge readiness](BACKEND_MERGE_READINESS.md).

## Phần Mobile từ chặng trước được giữ và đưa vào Git

- `app.json`, `eas.json`, manifest/lockfile: Expo project hiện có, package Android `vn.civicmerge.demo`, preview internal APK, HTTP LAN thông qua SDK 58 build-properties. Không đổi owner/projectId hoặc ký bằng keystore mới.
- Trang chủ nhập/lưu URL backend bằng FileSystem document file; `backend-settings.ts` và backend URL có thể đổi trên điện thoại, không cần build lại chỉ vì đổi IP.
- Tách `EXPO_PUBLIC_MOCK_MODE` khỏi `EXPO_PUBLIC_MOCK_CONTROLS`. Preview hiển thị mock rõ ràng nhưng không gọi API scenario/reset trên backend PostgreSQL.
- Các sửa layout/ảnh/upload từ chặng chuẩn bị APK trước được giữ nguyên. Root scripts export Android/build APK và dependency `expo-build-properties` đã vào chung một lockfile.

## Lỗi tương thích sửa trong chặng này

- HTTP client giữ **HTTP status/domain code** qua `ApiRequestError`, không chỉ giữ message. Response JSON hỏng, timeout, network failure không bị coi như chắc chắn thao tác chưa chạy.
- Confirm chỉ mở lại lựa chọn khi lỗi chắc chắn bị từ chối theo contract: validation 400, report/incident không tồn tại 404, merge khác loại 409. Timeout/5xx/response không rõ kết quả và `REPORT_ALREADY_CONFIRMED` tiếp tục khóa lựa chọn, chỉ retry cùng request để giữ idempotency.
- Candidate detail dùng `Promise.allSettled`; một hồ sơ tải lỗi không làm mất các hồ sơ khác đã tải được. Chỉ cho merge vào candidate đã đọc được minh chứng; có nút tải lại.
- URL backend chỉ nhận HTTP(S) origin, từ chối dán cả `/health`, credential, query hoặc fragment. Không tự đổi HTTPS thành HTTP; người dùng chọn đúng giao thức.
- Connection note dùng health capabilities nếu có để nhận biết PostgreSQL/Storage; response health cũ không có capabilities vẫn được hỗ trợ. Disclosure mock vẫn giữ vì AI/matching chưa thật.

Tham khảo API đã đọc trước sửa: [SDK 58 FileSystem](https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/), [BuildProperties](https://docs.expo.dev/versions/v58.0.0/sdk/build-properties/), [app config/versionCode](https://docs.expo.dev/versions/v58.0.0/config/app/), [Expo docs index](https://docs.expo.dev/llms.txt).

## Kiểm chứng

- `npm run typecheck`, `npm run lint`: PASS.
- `npm run test:mobile`: PASS 2/2. Phân loại definite/ambiguous confirm errors và validate origin; không giả lập rằng UI đã chạy trên điện thoại.
- `npm run test:modules`: PASS; `npm run test:integration`: PASS 18/18 với dữ liệu riêng.
- `npm run mobile:export:android`: PASS, bundle/assets xuất vào `apps/mobile/dist` (gitignored). **Export không tạo APK mới.**
- `npm ci --dry-run --ignore-scripts --offline` với snapshot manifest/lockfile staged riêng: PASS; không cài hoặc xóa node_modules đang dùng.
- Chưa chạy test UI tự động trên Android/iOS hoặc kiểm chứng sửa lỗi confirm/candidate trên thiết bị. Không thêm dependency test native chỉ để kiểm tra helper.

## APK đang có và APK cần build

Link APK trong [ANDROID_APK.md](ANDROID_APK.md) là bản đã build trước, **versionCode 1**, đã được người dùng xác nhận cài và kết nối API. Nó chưa bao gồm các sửa client ở chặng readiness.

Source hiện chuẩn bị **versionCode 2** cho lần build tiếp theo, giữ version `1.0.0`, package/project/signing key cũ. Chặng này không gửi thêm build lên Expo, không tạo IPA/APK native mới. Người 1/nhóm build bằng profile preview sau khi review/tích hợp, giữ keystore hiện có. Sau thay đổi Mobile sau này, tiếp tục quản lý versionCode trước mỗi bản phát hành.

## Các bước còn cần thiết bị

1. APK cũ có thể đổi URL sang backend 3011 để thử pipeline/database/ảnh Storage theo [demo runbook](DEMO_RUNBOOK.md).
2. Build/cài APK mới từ source này để kiểm chứng các sửa client. Không gỡ app cũ chỉ để né signing/version mismatch; giữ đúng project/package/keystore khi build.
3. Kiểm tra URL lưu sau đóng/mở, camera/gallery/GPS, thiếu GPS, tạo/merge hai báo cáo, ảnh minh chứng và reload.
4. Kiểm tra lỗi merge chắc chắn bị từ chối có thể chọn lại; khi timeout phải giữ cùng lựa chọn. Một candidate lỗi tải không được làm mất candidate tải thành công.
5. Hai điện thoại cùng backend là bước nghiệm thu riêng; một điện thoại gửi hai báo cáo không thay thế bước đó. iPhone vẫn cần kiểm tra thực tế.

## Giới hạn và bàn giao

Flow report đang trong React state, chưa có lưu draft/khôi phục pending report sau app bị tắt. Không bổ sung workflow này trong chặng readiness. API analyze chưa idempotent; không gửi lại vô hạn khi mạng chưa rõ kết quả. AI/matching vẫn mock; Người 2/4 cần bàn giao adapter thật để backend đăng ký, sau đó Người 1 phối hợp cờ disclosure và nghiệm thu lại.

Không đưa `.env`, APK/AAB, keystore, credential Expo/Supabase/OpenAI hoặc runtime uploads vào commit. Không tự push/merge nhánh này vào branch của Người 1 hoặc main.
