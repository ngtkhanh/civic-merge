import {
  AnalyzeResponseSchema, ApiErrorSchema, ConfirmResponseSchema, HealthSchema,
  IncidentDetailSchema, IncidentListResponseSchema, MockStateSchema,
  type ConfirmRequest, type Location, type MockScenario,
} from '@civicmerge/contracts';
import { File } from 'expo-file-system';
import { fetch } from 'expo/fetch';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
export const MOCK_MODE = process.env.EXPO_PUBLIC_MOCK_MODE === 'true';
export interface UploadImage { uri: string; name: string; type: string }

async function request<T>(route: string, schema: { parse(value: unknown): T }, init: RequestInit = {}): Promise<T> {
  if (!/^https?:\/\//.test(API_URL)) throw new Error('Chưa cấu hình EXPO_PUBLIC_API_URL trong apps/mobile/.env.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(API_URL + route, { ...init, signal: controller.signal });
    const body: unknown = await response.json();
    if (!response.ok) {
      const parsed = ApiErrorSchema.safeParse(body);
      throw new Error(parsed.success ? parsed.data.error.message : `API trả lỗi HTTP ${response.status}.`);
    }
    return schema.parse(body);
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Yêu cầu quá thời gian chờ. Kiểm tra mạng rồi thử lại.');
    if (error instanceof TypeError) throw new Error('Không kết nối được API. Kiểm tra địa chỉ LAN và Wi-Fi.');
    throw error;
  } finally { clearTimeout(timeout); }
}
const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const api = {
  health: () => request('/health', HealthSchema),
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
