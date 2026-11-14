# CivicMerge

**One Issue, One Record — Một sự cố, một hồ sơ thống nhất.**

CivicMerge giúp người dân phản ánh sự cố đô thị bằng ảnh và vị trí. AI hỗ trợ nhận diện, mô tả sự cố; hệ thống tìm các hồ sơ có thể trùng để người dùng xem và xác nhận hợp nhất. Nhiều phản ánh về cùng một sự cố được tập hợp vào một hồ sơ, giữ lại từng báo cáo và ảnh minh chứng.

MVP tập trung vào **ổ gà, rác thải và ngập nước**, với ứng dụng React Native/Expo cho iOS và Android.

> **Trạng thái ngày 14/11/2026:** Theo xác nhận của nhóm, luồng tích hợp với OpenAI Vision, matching GPS/đặc điểm ảnh, PostgreSQL và Supabase Storage đã chạy được. Repo vẫn giữ chế độ mock để phát triển và kiểm thử; cấu hình chạy quyết định module nào được sử dụng.

## Người dùng và vấn đề

| Người dùng mục tiêu | Khó khăn CivicMerge hướng tới giải quyết |
|---|---|
| Sinh viên, cư dân chung cư và khu đô thị | Mất công viết mô tả, chọn loại sự cố, tìm nơi tiếp nhận và theo dõi phản ánh |
| Ban quản lý trường học, chung cư và khu đô thị | Phải đọc, phân loại và đối chiếu nhiều phản ánh về cùng một sự cố |

Giá trị cốt lõi là giảm thao tác báo cáo và tập hợp thông tin phân tán thành hồ sơ có nhiều minh chứng, giúp bên tiếp nhận dễ theo dõi hơn.

**Bằng chứng về nhu cầu:** Tài liệu trong repo chưa ghi nhận phỏng vấn, khảo sát hoặc dữ liệu phản ánh thực tế từ người dùng ngoài nhóm. Các khó khăn trên là giả thuyết cần tiếp tục xác thực; kết quả chạy ứng dụng chứng minh khả năng thực hiện luồng sản phẩm, không thay cho bằng chứng về nhu cầu hay hiệu quả ngoài thực tế.

## AI giúp người dùng như thế nào?

1. **Chụp hoặc chọn ảnh:** Ứng dụng lấy vị trí khi người dùng cho phép.
2. **Phân tích ảnh:** Backend gọi OpenAI Vision để gợi ý loại sự cố, mô tả, mức độ nghiêm trọng và đặc điểm ảnh, giúp giảm nhập liệu.
3. **Tìm hồ sơ có thể trùng:** Thuật toán matching kết hợp loại sự cố, GPS và đặc điểm ảnh để xếp hạng ứng viên.
4. **Người dùng xác nhận:** Xem ảnh minh chứng rồi chọn tạo hồ sơ mới hoặc hợp nhất vào hồ sơ đã có.
5. **Lưu và theo dõi:** Lưu báo cáo, ảnh và lịch sử; gán tổ xử lý theo bảng quy tắc thí điểm.

AI phân tích nội dung ảnh; matching là thuật toán so khớp; phân công tổ xử lý là quy tắc. **Hệ thống chỉ đề xuất hợp nhất, người dùng quyết định.** Nhóm không tự huấn luyện mô hình AI.

## Demo trực tiếp trên điện thoại

Kịch bản trình diễn trên **iPhone thật (iOS)**:

1. Đóng hẳn rồi mở lại ứng dụng, kết nối backend của nhóm.
2. Chụp/chọn ảnh thật của một sự cố, lấy GPS và gửi phân tích AI.
3. Xem kết quả, xác nhận **Tạo hồ sơ mới** và ghi lại hồ sơ vừa tạo.
4. Gửi ảnh khác của cùng sự cố ở gần vị trí đầu; xem hồ sơ được đề xuất cùng ảnh minh chứng.
5. Chọn **Xác nhận hợp nhất**, mở chi tiết để kiểm tra **một incident, hai reports và hai ảnh**.
6. Tải lại hoặc mở lại ứng dụng để xem hồ sơ đã lưu.

Có thể dùng hai điện thoại cùng backend để trình diễn hai người cùng phản ánh. Một điện thoại gửi hai ảnh chỉ chứng minh luồng trên một thiết bị.

Ứng dụng cũng có [hướng dẫn cài APK Android](docs/ANDROID_APK.md). APK cũ không tự nhận thay đổi mã nguồn; cần dùng bản build phù hợp với phiên bản đem demo.

## Phần chuẩn bị trước và phần làm trong ngày

| Thời điểm | Phạm vi |
|---|---|
| **Chuẩn bị trước** | Xây dựng ý tưởng, thiết kế luồng nghiệp vụ và dựng khung chạy được với dữ liệu mock |
| **Trong ngày** | Hoàn thiện giao diện mobile; xây dựng module phân tích ảnh qua OpenAI và matching GPS/đặc điểm ảnh; tích hợp backend với PostgreSQL và Supabase Storage; kiểm thử luồng tạo hồ sơ và xác nhận hợp nhất |

## Công nghệ, công cụ và bài học

| Thành phần | Công nghệ / vai trò |
|---|---|
| Mobile | React Native, Expo, Expo Router, TypeScript |
| Backend | Node.js, Express, TypeScript; Mobile giao tiếp qua HTTP API |
| Phân tích ảnh | OpenAI Vision API, gọi từ backend |
| Matching | Thuật toán GPS và đặc điểm ảnh do nhóm xây dựng |
| Dữ liệu và ảnh | Supabase PostgreSQL và Supabase Storage |
| Cấu trúc dự án | npm workspaces, schema/interface dùng chung trong `packages/contracts/` |
| Phối hợp | Git/GitHub |
| Hỗ trợ phát triển | Codex hỗ trợ dựng khung mock, viết và rà soát mã, xử lý lỗi tích hợp, bổ sung kiểm thử và tài liệu |

**Một bài học:** Thống nhất cấu trúc dữ liệu và interface từ sớm giúp các thành viên phát triển song song, thay module mock bằng module thật và tích hợp ít vướng mắc hơn.

## Người dùng đầu tiên và hướng mở rộng

Nhóm dự kiến phối hợp với ban quản lý tại một trường đại học hoặc khu chung cư để thử nghiệm trong phạm vi nhỏ. Người dùng được tiếp cận qua nhóm cộng đồng và mã QR; nhóm sẽ thu thập phản hồi, đo thời gian gửi báo cáo, tỷ lệ phản ánh trùng và mức độ sử dụng lại.

Từ kết quả thí điểm, sản phẩm có thể mở rộng sang các trường học, khu đô thị và khu công nghiệp bằng cách điều chỉnh loại sự cố và quy tắc phân công. Hướng kinh doanh dự kiến là phần mềm thuê bao cho đơn vị quản lý, người dân gửi phản ánh miễn phí. Về dài hạn, nhóm hướng tới tích hợp với hệ thống phản ánh đô thị và dịch vụ công hiện có. Đây là kế hoạch phát triển, chưa phải xác nhận đã có đối tác hoặc khách hàng trả tiền.

## Chạy repo

### Yêu cầu

- Node **24.x**, từ **24.13.0**; toolchain đã kiểm tra: Node **24.21.0**, npm **11.19.0**.
- Client iOS/Android tương thích **Expo SDK 58**, hoặc bản build ứng dụng của nhóm. Xem [hướng dẫn iPhone](docs/IPHONE_SETUP.md) và [Android](docs/ANDROID_APK.md).
- Điện thoại truy cập được backend qua LAN; chạy OpenAI/Supabase cần kết nối Internet và credential riêng.

Chạy lệnh từ root repo. Trên PowerShell, dùng `npm.cmd` / `npx.cmd` nếu `.ps1` bị chặn.

```sh
npm ci
```

Tạo cấu hình nếu chưa có; giữ nguyên file đang sử dụng:

```powershell
if (!(Test-Path apps/api/.env)) { Copy-Item .env.example apps/api/.env }
if (!(Test-Path apps/mobile/.env)) { Copy-Item apps/mobile/.env.example apps/mobile/.env }
```

Đặt `PUBLIC_BASE_URL` ở backend và `EXPO_PUBLIC_API_URL` ở Mobile cùng là URL LAN của laptop, ví dụ `http://192.168.1.20:3000`. Nếu app đã lưu URL ở mục **Kết nối máy chủ**, cập nhật cả địa chỉ đó. `localhost` trên điện thoại trỏ về chính điện thoại.

### Chạy đầy đủ module thật

Trong `apps/api/.env`, chọn:

```dotenv
PERSISTENCE_MODE=postgres
STORAGE_PROVIDER=supabase
AI_PROVIDER=openai
MATCHING_PROVIDER=real
MOCK_MODE=false
```

Cấu hình riêng `DATABASE_URL`, TLS database, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET`, `OPENAI_API_KEY` và `OPENAI_MODEL`. Xem [database và migration](supabase/README.md), [Storage](docs/BACKEND_STORAGE.md) và [module Vision](packages/ai-vision/README.md).

Trong `apps/mobile/.env`, đặt `EXPO_PUBLIC_MOCK_MODE=false` và `EXPO_PUBLIC_MOCK_CONTROLS=false`. Key OpenAI và credential database/Supabase chỉ đặt ở backend; không đưa vào Mobile hoặc commit `.env`.

```sh
npm run backend:check
npm run dev:api
```

`backend:check` kiểm tra cấu hình và khả năng truy cập database/bucket, không phân tích ảnh hoặc tạo báo cáo. Mở terminal thứ hai:

```sh
npm run dev:mobile
```

Trên trình duyệt điện thoại, mở `http://<LAN-IP>:3000/health`. Với cấu hình đầy đủ, kết quả có:

```json
{
  "status": "ok",
  "mode": "real",
  "capabilities": {
    "persistence": "postgres",
    "storage": "supabase",
    "vision": "openai",
    "matching": "real"
  }
}
```

Health cho biết các provider được chọn; gửi một ảnh mới để kiểm tra lần phân tích thực tế. Mở ứng dụng và thực hiện kịch bản demo ở trên.

### Chạy mock để xem luồng, không cần credential

Trong `apps/api/.env`, chọn `PERSISTENCE_MODE=memory`, `STORAGE_PROVIDER=local`, `AI_PROVIDER=mock`, `MATCHING_PROVIDER=mock`, `MOCK_MODE=true`. Trong Mobile, chọn `EXPO_PUBLIC_MOCK_MODE=true` và `EXPO_PUBLIC_MOCK_CONTROLS=true`, rồi chạy hai terminal API/Mobile như trên.

Chọn kịch bản **Ổ gà** và **Dùng vị trí mẫu (demo)** cho hai lần gửi ảnh; lần đầu tạo mới, lần sau xác nhận hợp nhất. Dữ liệu nghiệp vụ trong memory mất khi restart backend. Chỉ chế độ memory/local/mock/mock có controls đổi scenario/reset; không reset backend dùng chung khi người khác đang sử dụng.

**Launcher `CivicMerge.cmd` / `npm run demo:start` là luồng riêng:** dùng PostgreSQL và Supabase Storage, nhưng cố ý ép AI/matching sang mock, cổng mặc định 3011. Launcher này cần credential lưu trữ và không dùng để demo AI thật. Xem [demo runbook](docs/DEMO_RUNBOOK.md).

## Khai báo dữ liệu mô phỏng và phạm vi MVP

- Bốn PNG trong [`mocks/images/`](mocks/images/README.md) là ảnh tổng hợp từ hình học, dùng kiểm tra upload/hiển thị; không phải dữ liệu sự cố thật hoặc dữ liệu đánh giá AI.
- Trong chế độ mock, kết quả Vision theo scenario, không theo nội dung ảnh; điểm matching `0.92` và khoảng cách `12 m` là cố định. Vị trí mẫu được ghi rõ là demo.
- Matching thật trả điểm xếp hạng, không phải xác suất hay tỷ lệ chính xác. Repo chưa có kết quả đánh giá hiện trường để công bố độ chính xác hoặc mức tiết kiệm thời gian.
- Các tổ đường bộ/vệ sinh/thoát nước là tổ xử lý thí điểm theo bảng quy tắc. MVP chưa tự gửi phản ánh đến cơ quan nhà nước hoặc tích hợp hệ thống chính quyền.
- Thiếu GPS vẫn gửi báo cáo được, nhưng không có đề xuất hồ sơ trùng và có cảnh báo.
- Analyze chỉ tạo báo cáo chờ xác nhận. Retry confirm cùng lựa chọn không nhân đôi dữ liệu; đổi lựa chọn sau khi đã xác nhận trả conflict.
- Backend hiện dành cho môi trường phát triển/demo tin cậy, chưa có xác thực người dùng hoặc cấu hình triển khai production. Upload giới hạn 8 MB, kiểm tra MIME/chữ ký ảnh; chưa kiểm tra giải mã toàn ảnh.

## Kiểm thử và bằng chứng chạy

Các lệnh kiểm tra chính:

```sh
npm run typecheck
npm run lint
npm run test:modules
npm run test:integration
npm run test --workspace=@civicmerge/ai-vision
npm run test --workspace=@civicmerge/matching
npm run test:mobile
npm run test:storage
npm run test:demo
npm run mobile:export
```

Tests tự động kiểm tra logic module, API, create/merge, retry và các nhánh lỗi. Một số test dùng phản hồi OpenAI/Storage giả lập; kết quả PASS của chúng không đồng nghĩa đã gọi dịch vụ live. Export iOS kiểm tra bundle, không tạo IPA hoặc thay cho chạy trên thiết bị. Test database/live có cấu hình riêng; không dùng database/bucket đang demo làm nơi reset hoặc nạp fixture.

**Xác nhận hiện tại:** Ngày 14/11/2026, nhóm xác nhận toàn bộ luồng tích hợp với các module thật đã chạy được. Các báo cáo dưới đây lưu kết quả tự động và thủ công theo từng giai đoạn; những mục “chưa nghiệm thu” ở báo cáo cũ phản ánh thời điểm soạn tài liệu đó:

- [Kiểm chứng nền mock và iPhone + giả lập](docs/VERIFICATION_REPORT.md)
- [Kiểm chứng backend/database/Storage](docs/BACKEND_VERIFICATION.md)
- [Kiểm thử bản tích hợp các module](docs/BACKEND_MERGE_READINESS.md)
- [Hướng dẫn kiểm thử tích hợp](docs/INTEGRATION_TESTS.md)

## Cấu trúc repo và tài liệu

| Đường dẫn | Nội dung |
|---|---|
| `apps/mobile/` | Ứng dụng iOS/Android |
| `apps/api/` | HTTP API, cấu hình và nối các module |
| `packages/contracts/` | Schema dữ liệu và interface dùng chung |
| `packages/ai-vision/` | Vision mock và adapter OpenAI |
| `packages/matching/` | Matching mock, matching GPS/đặc điểm ảnh và routing theo quy tắc |
| `supabase/` | Migration và hướng dẫn database |
| `tests/`, `mocks/` | Kiểm thử và dữ liệu mô phỏng |

- [Tổng quan sản phẩm](docs/CivicMerge_Project_Overview.md)
- [Kiến trúc](docs/ARCHITECTURE.md) · [API contract](docs/API_CONTRACT.md)
- [Thỏa thuận phát triển nhóm](docs/CivicMerge_Team_Development_Agreement.md)
- [Bàn giao Matching](docs/CivicMerge_Matching_Handoff.md)
- [Hướng dẫn database](supabase/README.md) · [Hướng dẫn Storage](docs/BACKEND_STORAGE.md)
