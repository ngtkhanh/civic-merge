# CivicMerge

One Issue, One Record — nền tích hợp cho đội bốn người. Backend hỗ trợ PostgreSQL và Supabase Storage thật; AI/matching hiện vẫn mock. Ưu tiên iOS/iPhone thật; mỗi người chạy backend riêng khi phát triển, dùng chung một backend khi tích hợp/demo.

## Yêu cầu

- Node **24.x LTS**, từ 24.13.0; phiên bản đã kiểm tra: **24.21.0**, npm **11.19.0**.
- Client iOS tương thích **Expo SDK 58** để thử thiết bị. Xem [hướng dẫn iPhone](docs/IPHONE_SETUP.md) trước bước này.
- Laptop và điện thoại có thể kết nối qua LAN. Không cần OpenAI/Supabase key để chạy mock.

## Cài và chạy

Chạy từ root repo. Trên PowerShell nếu `npm.ps1` bị chặn, thay `npm` bằng `npm.cmd`, `npx` bằng `npx.cmd`; không cần thay execution policy.

```sh
npm ci
```

Tạo hai file cấu hình (không ghi đè nếu đã tồn tại):

```powershell
if (!(Test-Path apps/api/.env)) { Copy-Item .env.example apps/api/.env }
if (!(Test-Path apps/mobile/.env)) { Copy-Item apps/mobile/.env.example apps/mobile/.env }
```

Đổi **hai địa chỉ mẫu** trong các file vừa tạo sang cùng địa chỉ LAN của laptop, ví dụ:

```dotenv
# apps/api/.env
PUBLIC_BASE_URL=http://192.168.1.20:3000
# apps/mobile/.env
EXPO_PUBLIC_API_URL=http://192.168.1.20:3000
```

Giữ `MOCK_MODE=true` ở backend và `EXPO_PUBLIC_MOCK_MODE=true` ở mobile. Dùng `ipconfig` trên Windows để tìm IPv4 của Wi-Fi đang sử dụng, tránh chọn adapter VPN/ảo.

Terminal 1:

```sh
npm run dev:api
```

Terminal 2:

```sh
npm run dev:mobile
```

Trước khi quét QR, mở `http://<IP-laptop>:3000/health` bằng Safari trên iPhone; phải thấy `{"status":"ok","mode":"mock"}`. Sau đó mở dự án bằng client Expo tương thích. Mobile lấy dữ liệu qua HTTP thật và kiểm tra response theo shared schema.

## Chạy demo hai ảnh → một hồ sơ

Để thử **PostgreSQL + Supabase Storage thật với AI/matching mock**, dùng backend riêng cổng 3011 theo [demo runbook](docs/DEMO_RUNBOOK.md): trên Windows double-click **`CivicMerge.cmd`** tại root repo, hoặc `npm run demo:start` bằng Node 24. Launcher tự tìm IP và khởi động lại đúng demo khi IP đổi. `demo:check` chỉ đọc cấu hình, `demo:status` xem phiên và `demo:stop` dừng đúng demo qua IPC. Không thay backend 3000 hoặc reset dữ liệu. Các bước reset bên dưới chỉ dành cho memory/local/mock/mock.

1. Chỉ định **một backend**, cho hai điện thoại dùng cùng URL API; phối hợp trước khi reset.
2. Trang chủ → **Reset dữ liệu mock** (hoặc chạy `npm run mock:reset` trên máy đang chạy backend).
3. Điện thoại 1 → Báo cáo → chụp/chọn ảnh đầu → **Dùng vị trí mẫu (demo)** → kịch bản **Ổ gà** → phân tích → **Tạo hồ sơ mới**.
4. Điện thoại 2 → Báo cáo → ảnh thứ hai → cùng vị trí mẫu và kịch bản → phân tích → xem minh chứng → **Xác nhận hợp nhất**.
5. Mở chi tiết: phải thấy **2 minh chứng**, một tổ xử lý và hai sự kiện lịch sử trong cùng hồ sơ. Tải lại danh sách trên điện thoại 1 để xem cập nhật.
6. Đóng/mở Mobile và xem lại khi backend vẫn chạy. Khởi động lại backend sẽ mất dữ liệu mock.

Có thể dùng ảnh riêng hoặc bốn PNG tổng hợp trong `mocks/images/`. Backend không phân tích nội dung ảnh trong mock mode; scenario trên màn báo cáo chọn kết quả. Khoảng cách 12 m và score 0.92 là cố định, chưa phải kết quả thuật toán thật.

## Các kịch bản khác

- **Rác thải / Ngập nước:** chọn scenario tương ứng; chỉ incident cùng loại và có vị trí mới được mock đề xuất.
- **AI lỗi:** backend trả 503, không tạo report hoặc lưu ảnh.
- **Không GPS:** chọn gửi không kèm GPS; được báo cáo nhưng candidates rỗng và có cảnh báo.
- **Retry confirm:** cùng report/lựa chọn trả kết quả xác nhận ban đầu; đổi lựa chọn trả 409.
- **Reset:** chỉ xóa dữ liệu nghiệp vụ trong backend đang chạy, phục hồi scenario ổ gà. Ảnh local cũ còn trong `.runtime/uploads/`, không được đưa vào Git.
- Script reset mặc định gọi `127.0.0.1:<PORT>`; đặt `MOCK_API_URL` khi muốn trỏ vào backend khác. Không dùng reset trên backend chung khi người khác đang thử.

## Kiểm chứng

```sh
npm run typecheck
npm run lint
npm run test:modules
npm run test:integration
npm run mobile:export
```

- `test:modules`: chạy fixtures/schema và adapter riêng, không cần Mobile/backend đang chạy.
- `test:integration`: tự mở server trên port ngẫu nhiên, kiểm tra pipeline và cleanup thư mục test riêng.
- `mobile:export`: kiểm tra Metro đóng gói iOS; **không tạo IPA hoặc chứng minh đã chạy trên iPhone**.
- Trong sandbox Windows, tsx có thể lỗi `uv_os_get_passwd`; chạy ở terminal được phép truy cập tài khoản Windows. Không sửa code nghiệp vụ để né lỗi môi trường này.

## Phân công và thay module thật

| Người | Thư mục | Bước tiếp theo |
|---|---|---|
| 1 | `apps/mobile/` | Hoàn thiện UI, nghiệm thu iPhone |
| 2 | `packages/ai-vision/` | Implement `VisionAnalyzer`, trả analysis hợp schema hoặc `DomainError` |
| 3 | `apps/api/`, `supabase/` | Bàn giao PostgreSQL/Storage; lắp factory thật sau khi nhận từ Người 2/4 |
| 4 | `packages/matching/` | Implement `DuplicateMatcher`; GPS/scoring; điều phối tích hợp |

Schema và interfaces ở `packages/contracts/src/index.ts`. Server dùng `apps/api/src/bootstrap/configured.ts` để chọn persistence/storage/vision/matching độc lập và inject vào `createApp`. Factory AI/matching thật được đăng ký sau khi owner bàn giao; chọn provider chưa có sẽ lỗi startup, không fallback. `bootstrap/mock.ts` và `bootstrap/postgres.ts` được giữ tương thích cho caller/test cũ.

Mặc định `PERSISTENCE_MODE=memory`, `STORAGE_PROVIDER=local`, `AI_PROVIDER=mock`, `MATCHING_PROVIDER=mock` vẫn chạy nền cũ. Chọn `postgres` và `supabase` để lưu nghiệp vụ/ảnh bền vững, giữ AI/matching mock rõ ràng. Chỉ tổ hợp memory/local/mock/mock có reset/scenario API. Cấu hình và migration ở [hướng dẫn database](supabase/README.md); Storage private, URL ảnh ổn định, kiểm thử riêng và điểm lắp factory ở [bàn giao backend/Storage](docs/BACKEND_STORAGE.md). `npm run backend:check` kiểm tra startup chỉ đọc, không mở server hoặc sửa dữ liệu. Health có thêm `capabilities` tùy chọn, các field cũ giữ nguyên.

Không đổi contract riêng trong từng branch. Workflow nhóm vẫn yêu cầu nghiệm thu/review trước tích hợp. Theo yêu cầu chặng database của Người 3, đã tạo `feature/backend` từ `411279b` trên `chore/mock-foundation`; chưa merge vào `main`, commit hoặc push chặng database.

## Giới hạn hiện tại

- Chọn AI mock/OpenAI và matching mock/GPS-features độc lập; các factory bàn giao đã được ghép. OpenAI được kiểm thử bằng mạng giả lập, chưa gọi dịch vụ thật; xem [chuẩn bị merge backend](docs/BACKEND_MERGE_READINESS.md). Database memory/PostgreSQL và ảnh local/Supabase private giữ nguyên. APK cũ đã cài/kết nối theo xác nhận người dùng; chưa nghiệm thu camera/GPS/create/merge hoặc build APK mới chứa source vừa ghép. Chưa auth/Internet/FPT; backend và proxy ảnh dành cho môi trường phát triển tin cậy.
- Upload giới hạn 8 MB, MIME và chữ ký JPEG/PNG/WebP phải khớp; đây chưa phải kiểm tra giải mã toàn ảnh. Mobile chuẩn hóa ảnh chọn/chụp sang JPEG.
- Chưa kiểm chứng camera/GPS, quyền mạng, Dynamic Type, xoay màn hình hoặc luồng hai điện thoại trên iPhone thật.
- `npm audit` tại lần triển khai này báo **8 moderate** trong chuỗi Expo/fingerprint và TypeScript ESLint dùng minimatch. `npm audit fix` không giải quyết được các cảnh báo; không chạy `--force` vì đề xuất downgrade Expo major. Cần theo dõi bản sửa tương thích SDK.

## Tài liệu

- [Phương án thống nhất đội](docs/CivicMerge_Team_Development_Agreement.md)
- [Checklist nền mock](docs/CivicMerge_Mock_Foundation_Plan.md)
- [Hướng dẫn iPhone](docs/IPHONE_SETUP.md)
- [Đóng gói và cài APK Android](docs/ANDROID_APK.md)
- [Kiến trúc](docs/ARCHITECTURE.md)
- [Cấu hình backend và Storage](docs/BACKEND_STORAGE.md)
- [Bàn giao và tích hợp Backend/Matching](docs/MATCHING_BACKEND_INTEGRATION.md)
- [Kiểm chứng backend/Storage](docs/BACKEND_VERIFICATION.md)
- [API contract](docs/API_CONTRACT.md)
- [Kiểm thử và nghiệm thu](docs/INTEGRATION_TESTS.md)
- [Task board](docs/TASK_BOARD.md)
- [Đối chiếu MVP và backlog triển khai](docs/MVP_READINESS_AUDIT.md)
