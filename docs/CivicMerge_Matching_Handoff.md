# CivicMerge — Bàn giao matcher GPS/features

Ngày kiểm chứng: 14/11/2026. Source: working tree trên `feature/matching`, chưa commit/push.

## Factory để Backend nối

```ts
import { createGpsFeatureMatcher } from '@civicmerge/matching';

const matcher = createGpsFeatureMatcher({ radiusMeters: 100, maxCandidates: 3 });
```

Options đều tùy chọn, mặc định bán kính 100 m/top 3. Bán kính phải hữu hạn và dương; top K phải là số nguyên dương an toàn. Factory chụp giá trị options lúc khởi tạo, không đọc env, không giữ state dùng chung.

Giữ nguyên `DuplicateMatcher.findCandidates({ analysis, location, incidents })` và các export `mockMatcher`, `ruleRouter`. Không thay contracts, API implementation, Mobile, dependency hoặc lockfile.

Matcher kiểm tra dữ liệu bằng shared schemas; chỉ xét incident cùng loại, có GPS, chưa resolved và trong bán kính. Tính Haversine với R=6_371_000 m, Jaccard trên tập features; features rỗng không được điểm khớp. Tags so sánh chính xác, không suy đồng nghĩa hoặc chuẩn hóa tag sai.

```text
score = 0.7 / (1 + distanceMeters / radiusMeters) + 0.3 * featureJaccard
```

Không có ngưỡng score tối thiểu; score là điểm xếp hạng, không phải xác suất. Sắp xếp theo score giảm, khoảng cách tăng, ID tăng; lọc/rank trước khi làm tròn. Output làm tròn score đến bốn chữ số thập phân, khoảng cách đến 0.1 m, kèm reasons từ dữ liệu thực. Không ghi dữ liệu hoặc tự merge.

## Người 3 — bước nối trên branch Backend

Theo phản hồi Backend, dùng registry hiện có, **không thêm selector mới**:

```ts
// Ví dụ ghép trong bootstrap của Backend, không phải code đã có trên branch matching.
createConfiguredBackend(env, {
  root,
  factories: { realMatcher: () => createGpsFeatureMatcher() },
});
```

Cấu hình vòng ghép đầu tiên trên backend test riêng:

```dotenv
MOCK_MODE=true
AI_PROVIDER=mock
MATCHING_PROVIDER=real
PERSISTENCE_MODE=memory
STORAGE_PROVIDER=local
MOCK_SCENARIO=pothole
```

Configured bootstrap, registry và health capabilities được Người 3 báo cáo trên branch Backend; chúng chưa có trong source branch matching đang kiểm chứng. Người 3 nối factory tại server/bootstrap của mình, chọn port/URL/thư mục test riêng theo cấu hình thực tế. Không dùng launcher đang ép mock làm bằng chứng chạy matcher thật.

Health tổng thể vẫn mock khi AI còn mock; kiểm tra capability matching là real trên Backend đã ghép. Theo configured bootstrap được báo cáo, controls scenario/reset không bật khi dùng matcher real; chọn `MOCK_SCENARIO` khi khởi tạo, không gọi controls để đổi scenario giữa phiên test.

## Policy resolved đã chốt — việc còn ở Backend/Mobile

- Người dùng đã chọn R1=A/R2=có chặn: matcher thật loại resolved khỏi candidates (đã làm).
- Người 3 bổ sung guard ở cả memory/PostgreSQL: merge mới vào resolved trả `INCIDENT_RESOLVED` 409, report giữ pending, không tăng count/history, không reopen.
- Kiểm tra confirmation cũ trước guard status: retry cùng lựa chọn đã thành công trả snapshot cũ; đổi lựa chọn vẫn `REPORT_ALREADY_CONFIRMED` 409.
- Kiểm tra lại status của incident trong transaction để xử lý resolve xảy ra sau analyze. Khi ghép, kiểm tra race resolve/confirm và parity memory/PostgreSQL.
- Người 1 xử lý `INCIDENT_RESOLVED` là rejection cho phép chọn tạo mới/đích khác; không đồng nhất với `REPORT_ALREADY_CONFIRMED`.

**Guard repository chưa được triển khai trên branch matching.** Việc không có resolved trong candidates không ngăn client gọi confirm trực tiếp. Chưa nghiệm thu policy đầy đủ cho đến khi Backend hoàn thành guard và tests.

## Kiểm chứng đã chạy

| Lệnh từ root | Kết quả |
|---|---|
| `npm.cmd run test --workspace=@civicmerge/matching` | PASS, 7 unit tests |
| `npm.cmd run test:integration` | PASS, 9 tests: 4 mới cho matcher thật + 5 hồi quy mock |
| `npm.cmd run typecheck` | PASS, bao gồm tooling, package và tests matching |
| `npm.cmd run lint` | PASS |
| `npm.cmd run test:modules` | PASS, smoke check fixtures/mock/routing |

Unit tests bao gồm khoảng cách chuẩn, biên GPS/kinh tuyến 180°/cực/đối cực; Jaccard và tags trùng/rỗng; lọc khác loại/xa/null GPS/resolved; bán kính inclusive; rank/top K/tie-break; không sửa input; input/options sai; routing đủ ba loại.

`tests/integration/matching.test.ts` inject matcher thật trực tiếp qua `createApp`, dùng fixture Vision, repository memory, ảnh local và HTTP server cổng ngẫu nhiên riêng. Chứng minh pending/create/nearby candidate/concurrent merge/retry/conflict, một incident/hai reports/hai ảnh đọc được, khác loại/ngoài bán kính, thiếu GPS không gọi matcher, đích merge sai giữ pending. Lỗi matcher/output sai không tạo pending hoặc lưu ảnh. Hai dòng log lỗi Error/ZodError trong suite là các ca lỗi được kiểm tra có chủ đích.

Windows sandbox làm `tsx` lỗi tại `os.userInfo()`; các lệnh test đã được chạy lại ngoài sandbox với quyền được cấp. Không sửa dependency hoặc bỏ kiểm thử để né lỗi môi trường.

## Phần chưa nghiệm thu

- Chưa ghép configured server của Người 3; chưa test PostgreSQL/Supabase/transaction thật với matcher mới.
- Chưa có bộ ảnh/analysis Vision thật để đánh giá scoring; PNG mock chỉ kiểm tra upload/luồng HTTP.
- Chưa chạy matcher mới trên iPhone hoặc hai điện thoại. Kết quả thiết bị Người 1 báo cáo thuộc nhánh Mobile của họ.
- Chưa kiểm chứng guard resolved ở repository và xử lý lỗi mới trên Mobile.

Các điểm mở này là bước tích hợp tiếp theo theo ownership, không phải điều kiện cần chờ để bàn giao module. Bán kính/trọng số vẫn là giá trị khởi đầu, chưa được hiệu chỉnh bằng dữ liệu hiện trường.
