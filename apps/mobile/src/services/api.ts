import {
  AnalyzeResponseSchema, ApiErrorSchema, ConfirmResponseSchema, HealthSchema,
  IncidentDetailSchema, IncidentListResponseSchema, MockStateSchema,
  type BackendCapabilities, type ConfirmRequest, type Location, type MockScenario,
} from '@civicmerge/contracts';
import { File } from 'expo-file-system';
import { fetch } from 'expo/fetch';
import { readBackendUrl, saveBackendUrl } from './backend-settings';
import { ApiRequestError } from './http-error';
import { describeProviders } from './provider-state';

export let API_URL = readBackendUrl();
let capabilities: BackendCapabilities | undefined;
export function setApiUrl(value: string) { API_URL = saveBackendUrl(value); capabilities = undefined; }
export const MOCK_MODE = process.env.EXPO_PUBLIC_MOCK_MODE === 'true';
// A persistent backend may still use mock AI without exposing reset/scenario APIs.
export const MOCK_CONTROLS = process.env.EXPO_PUBLIC_MOCK_CONTROLS === undefined
  ? MOCK_MODE : process.env.EXPO_PUBLIC_MOCK_CONTROLS === 'true';
export const providerState = () => describeProviders(capabilities, MOCK_CONTROLS);
export interface UploadImage { uri: string; name: string; type: string }

async function request<T>(route: string, schema: { parse(value: unknown): T }, init: RequestInit = {}): Promise<T> {
  if (!/^https?:\/\//.test(API_URL)) throw new Error('Hãy nhập và lưu địa chỉ máy chủ trên Trang chủ.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(API_URL + route, { ...init, signal: controller.signal });
    let body: unknown;
    try { body = await response.json(); }
    catch { throw new ApiRequestError('Máy chủ trả phản hồi không hợp lệ. Kết quả thao tác chưa xác định.', 'INVALID_RESPONSE', response.status); }
    if (!response.ok) {
      const parsed = ApiErrorSchema.safeParse(body);
      throw new ApiRequestError(parsed.success ? parsed.data.error.message : `API trả lỗi HTTP ${response.status}.`,
        parsed.success ? parsed.data.error.code : 'HTTP_ERROR', response.status);
    }
    return schema.parse(body);
  } catch (error) {
    if (controller.signal.aborted) throw new ApiRequestError('Yêu cầu quá thời gian chờ. Khi xác nhận, hãy thử lại cùng lựa chọn.', 'REQUEST_TIMEOUT');
    if (error instanceof TypeError) throw new ApiRequestError('Không kết nối được API. Kiểm tra địa chỉ LAN và Wi-Fi.', 'NETWORK_ERROR');
    throw error;
  } finally { clearTimeout(timeout); }
}
const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const api = {
  health: async () => {
    capabilities = undefined;
    const health = await request('/health', HealthSchema);
    capabilities = health.capabilities;
    return health;
  },
  list: () => request('/api/incidents', IncidentListResponseSchema),
  detail: (id: string) => request(`/api/incidents/${encodeURIComponent(id)}`, IncidentDetailSchema),
  confirm: (body: ConfirmRequest) => request('/api/reports/confirm', ConfirmResponseSchema, json(body)),
  async analyze(image: UploadImage, location: Location | null) {
    const form = new FormData();
    // Expo's fetch requires Blob/File bytes, not React Native's legacy URI object.
    form.append('image', new File(image.uri));
    if (location) { form.append('latitude', String(location.latitude)); form.append('longitude', String(location.longitude)); }
    return request('/api/reports/analyze', AnalyzeResponseSchema, { method: 'POST', body: form });
  },
  scenario: (scenario: MockScenario) => request('/api/mock/scenario', MockStateSchema, json({ scenario })),
  reset: () => request('/api/mock/reset', MockStateSchema, { method: 'POST' }),
};
