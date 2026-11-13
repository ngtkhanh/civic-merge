# Mock foundation — 13/11/2026

## Architecture

`packages/contracts/src/index.ts` là nguồn schema/interfaces; `apps/api/src/bootstrap/mock.ts` inject các adapter. `server.ts` chỉ chấp nhận MOCK_MODE=true cho đến khi có real bootstrap. Mobile dùng Expo Router ở `apps/mobile/src/app/`, implementation screens ở `src/screens/`.

## Patterns

Confirm cùng lựa chọn trả snapshot đã lưu, không lấy reportCount mới nhất; đọc detail để cập nhật. Repository bộ nhớ giữ phần validation/writes không await, chỉ đảm bảo trong một process; bản Supabase phải có transaction và constraint riêng. Hai điện thoại demo phải dùng cùng backend.

## Bugs & Solutions

Expo SDK 58 dùng serializer không nhận multipart part `{uri,name,type}` cũ. API client cần append `new File(uri)` từ expo-file-system; ép kiểu `as Blob` không chuyển đối tượng thành Blob. Tái hiện bằng convertFormDataAsync trong Expo; File-like bytes gửi được multipart và GPS đến Express. Khi test thiết bị còn thấy lỗi cũ, đối chiếu manifest.launchAsset.url đầy đủ (có transform.routerRoot=src/app) rồi cold-start client để nạp bundle mới.

Khi script có top-level await bị esbuild chuyển CJS, kiểm tra root package `type: module`. Khi tsx trên Windows sandbox lỗi uv_os_get_passwd/ENOMEM, kiểm tra quyền môi trường trước khi sửa code. Trong task này chạy được ngoài sandbox sau phê duyệt.

## How-To

Chạy typecheck, lint, test:modules, test:integration và mobile:export theo package.json. Export không chứng minh đã nghiệm thu iPhone; xem docs/VERIFICATION_REPORT.md và docs/IPHONE_SETUP.md. Reset API chỉ xóa dữ liệu nghiệp vụ, không xóa ảnh cũ local.
