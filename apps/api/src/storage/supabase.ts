import { randomUUID } from 'node:crypto';
import { DomainError, type ImageInput, type ImageStorage } from '@civicmerge/contracts';
import { MAX_IMAGE_BYTES, validateImageInput } from './image.js';
import { BackendConfigurationError } from '../configuration-error.js';
import type { ImageDelivery } from './delivery.js';
import { REFERENCE_ORIGIN, storageSegment as segment, storageFilename as filename, parseImageReference, publicImageUrl } from './reference.js';
export { parseImageReference, publicImageUrl } from './reference.js';

export interface SupabaseImageStorage extends ImageStorage, ImageDelivery {
  checkReady(): Promise<void>;
  readObject(bucket: string, prefix: string, name: string): Promise<ImageInput>;
  publicUrl(reference: string, baseUrl: string): string;
}
function storageError(code = 'STORAGE_UNAVAILABLE', status = 503) {
  return new DomainError(code, code === 'IMAGE_NOT_FOUND' ? 'Không tìm thấy ảnh minh chứng.'
    : code === 'STORAGE_TIMEOUT' ? 'Dịch vụ lưu ảnh phản hồi quá chậm. Hãy thử lại.'
    : code === 'STORAGE_CONFIG_ERROR' ? 'Kiểm tra SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_STORAGE_BUCKET và quyền bucket private trên backend.'
    : 'Không thể truy cập dịch vụ lưu ảnh. Hãy thử lại.', status);
}
async function readBounded(response: Response, limit: number): Promise<Uint8Array> {
  if (Number(response.headers.get('content-length')) > limit) {
    await response.body?.cancel(); throw storageError('STORAGE_INVALID_RESPONSE', 502);
  }
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw storageError('STORAGE_INVALID_RESPONSE', 502); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, size);
}

// REST calls follow the official storage-js object/bucket endpoints. Native fetch
// keeps cancellation and bounded downloads explicit without another SDK dependency.
export function createSupabaseStorage(options: {
  url: string; secretKey: string; bucket: string; prefix?: string; timeoutMs?: number; fetch?: typeof fetch;
}): SupabaseImageStorage {
  let url: URL;
  try { url = new URL(options.url); } catch { throw new BackendConfigurationError('Set SUPABASE_URL to the project HTTPS URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new BackendConfigurationError('SUPABASE_URL must be a project HTTPS origin without credentials or paths.');
  }
  if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(options.secretKey)) throw new BackendConfigurationError('Set SUPABASE_SECRET_KEY to a backend secret key (sb_secret_...).');
  if (!segment.test(options.bucket)) throw new BackendConfigurationError('Set a valid SUPABASE_STORAGE_BUCKET.');
  const prefix = options.prefix ?? 'evidence';
  if (!segment.test(prefix)) throw new BackendConfigurationError('Invalid SUPABASE_STORAGE_PREFIX.');
  const timeoutMs = options.timeoutMs ?? 10000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw new BackendConfigurationError('STORAGE_TIMEOUT_MS must be 1..30000.');
  const fetcher = options.fetch ?? fetch;
  const endpoint = `${url.origin}/storage/v1`;
  const headers = { apikey: options.secretKey };
  async function request(route: string, init: RequestInit = {}, limit = 65536) {
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const response = await fetcher(endpoint + route, {
        ...init, headers: { ...headers, ...init.headers }, signal, redirect: 'error',
      });
      const bytes = await readBounded(response, response.ok ? limit : 65536);
      if (!response.ok) {
        let status = response.status;
        try { const body = JSON.parse(Buffer.from(bytes).toString('utf8')); status = Number(body.statusCode) || status; } catch { /* Never expose upstream bodies. */ }
        if (status === 404) throw storageError('IMAGE_NOT_FOUND', 404);
        if ([401, 403].includes(status)) throw storageError('STORAGE_CONFIG_ERROR');
        throw storageError();
      }
      return { bytes, mimeType: response.headers.get('content-type')?.split(';')[0] ?? '' };
    } catch (error) {
      if (signal.aborted) throw storageError('STORAGE_TIMEOUT', 504);
      if (error instanceof DomainError) throw error;
      throw storageError();
    }
  }
  const owns = (bucket: string, scope: string, name: string) => bucket === options.bucket && segment.test(scope) && filename.test(name);
  return {
    async checkReady() {
      try {
        const response = await request(`/bucket/${options.bucket}`);
        const bucket = JSON.parse(Buffer.from(response.bytes).toString('utf8'));
        if (bucket.id !== options.bucket || bucket.public !== false) throw storageError('STORAGE_CONFIG_ERROR');
      } catch { throw storageError('STORAGE_CONFIG_ERROR'); }
    },
    async save(input) {
      const image = validateImageInput(input);
      const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[image.mimeType]!;
      const key = `${options.bucket}/${prefix}/${randomUUID()}.${extension}`;
      await request(`/object/${key}`, {
        method: 'POST', headers: { 'content-type': image.mimeType, 'x-upsert': 'false', 'cache-control': 'max-age=0' },
        body: new Uint8Array(image.bytes),
      });
      return `${REFERENCE_ORIGIN}/${key}`;
    },
    async readObject(bucket, scope, name) {
      if (!owns(bucket, scope, name)) throw storageError('IMAGE_NOT_FOUND', 404);
      const result = await request(`/object/authenticated/${bucket}/${scope}/${name}`, {}, MAX_IMAGE_BYTES);
      try { return validateImageInput(result); } catch { throw storageError('STORAGE_INVALID_RESPONSE', 502); }
    },
    async remove(reference) {
      const object = parseImageReference(reference);
      // Cleanup may delete only this adapter's upload scope, never another run.
      if (!object || !owns(object.bucket, object.prefix, object.name) || object.prefix !== prefix) throw storageError('STORAGE_INVALID_REFERENCE', 400);
      await request(`/object/${options.bucket}`, {
        method: 'DELETE', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prefixes: [`${object.prefix}/${object.name}`] }),
      });
    },
    publicUrl: publicImageUrl,
  };
}
