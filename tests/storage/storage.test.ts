import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { DomainError } from '@civicmerge/contracts';
import { createSupabaseStorage, parseImageReference, publicImageUrl } from '../../apps/api/src/storage/supabase.js';
import { readBackendConfig, createConfiguredBackend } from '../../apps/api/src/bootstrap/configured.js';
import { fakeStorage } from './helpers.js';

const png = await readFile(new URL('../../mocks/images/pothole-1.png', import.meta.url));
const input = { bytes: png, mimeType: 'image/png' };
const defaults = { url: 'https://project.supabase.co', secretKey: 'sb_secret_test', bucket: 'evidence-test', prefix: 'test-run' };
const domain = (code: string, status?: number) => (error: unknown) => {
  assert.ok(error instanceof DomainError); assert.equal(error.code, code);
  if (status) assert.equal(error.status, status);
  assert.doesNotMatch(error.message, /PRIVATE UPSTREAM|sb_secret_test/); return true;
};

test('private Storage upload/read/delete uses UUID durable references across adapter restarts', async () => {
  const fake = fakeStorage();
  const storage = createSupabaseStorage({ ...defaults, fetch: fake.fetcher });
  await storage.checkReady();
  const ref = await storage.save(input);
  const key = parseImageReference(ref)!;
  assert.equal(key.bucket, defaults.bucket); assert.equal(key.prefix, defaults.prefix);
  assert.match(key.name, /^[a-f0-9-]{36}\.png$/);
  assert.equal(new URL(ref).search, '');
  const restarted = createSupabaseStorage({ ...defaults, fetch: fake.fetcher });
  assert.deepEqual(Buffer.from((await restarted.readObject(key.bucket, key.prefix, key.name)).bytes), png);
  assert.equal(publicImageUrl(ref, 'http://new-backend:3000'), `http://new-backend:3000/api/images/${key.bucket}/${key.prefix}/${key.name}`);
  assert.equal(publicImageUrl('http://old-laptop/uploads/legacy.jpg', 'http://new-backend'), 'http://old-laptop/uploads/legacy.jpg');
  await restarted.remove(ref); assert.equal(fake.objects.size, 0);
  await assert.rejects(restarted.readObject(key.bucket, key.prefix, key.name), domain('IMAGE_NOT_FOUND', 404));
});

test('image validation rejects MIME mismatch, oversized bytes and traversal before remote writes', async () => {
  const fake = fakeStorage(); const storage = createSupabaseStorage({ ...defaults, fetch: fake.fetcher });
  await assert.rejects(storage.save({ ...input, mimeType: 'image/jpeg' }), domain('INVALID_IMAGE', 415));
  await assert.rejects(storage.save({ bytes: new Uint8Array(8 * 1024 * 1024 + 1), mimeType: 'image/png' }), domain('VALIDATION_ERROR', 413));
  await assert.rejects(storage.save({ bytes: new Uint8Array(), mimeType: 'image/png' }), domain('INVALID_IMAGE', 415));
  await assert.rejects(storage.remove('https://foreign.invalid/x'), domain('STORAGE_INVALID_REFERENCE', 400));
  await assert.rejects(storage.readObject('other-bucket', '..', '../file'), domain('IMAGE_NOT_FOUND', 404));
  assert.equal(fake.calls.length, 0);
});

test('configuration fails closed, private bucket required and cleanup cannot delete another run', async () => {
  assert.throws(() => createSupabaseStorage({ ...defaults, secretKey: '' }), /SUPABASE_SECRET_KEY/);
  assert.throws(() => createSupabaseStorage({ ...defaults, url: 'http://project.supabase.co' }), /HTTPS/);
  assert.throws(() => createSupabaseStorage({ ...defaults, bucket: '../x' }), /BUCKET/);
  const fake = fakeStorage(); fake.state.public = true;
  const storage = createSupabaseStorage({ ...defaults, fetch: fake.fetcher });
  await assert.rejects(storage.checkReady(), domain('STORAGE_CONFIG_ERROR'));
  fake.state.public = false;
  const ref = await storage.save(input);
  await assert.rejects(createSupabaseStorage({ ...defaults, prefix: 'another-run', fetch: fake.fetcher }).remove(ref), domain('STORAGE_INVALID_REFERENCE'));
  assert.equal(fake.objects.size, 1);
});

test('upstream failures and timeouts are redacted on upload/read/delete', async () => {
  const fake = fakeStorage(); const storage = createSupabaseStorage({ ...defaults, fetch: fake.fetcher });
  const ref = await storage.save(input); const key = parseImageReference(ref)!;
  fake.state.fail = '/object'; fake.state.status = 403;
  await assert.rejects(storage.save(input), domain('STORAGE_CONFIG_ERROR', 503));
  await assert.rejects(storage.readObject(key.bucket, key.prefix, key.name), domain('STORAGE_CONFIG_ERROR', 503));
  await assert.rejects(storage.remove(ref), domain('STORAGE_CONFIG_ERROR', 503));
  fake.state.status = 503; await assert.rejects(storage.save(input), domain('STORAGE_UNAVAILABLE', 503));
  const hanging: typeof fetch = (_url, init) => new Promise((_resolve, reject) => {
    init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true });
  });
  const slow = createSupabaseStorage({ ...defaults, timeoutMs: 10, fetch: hanging });
  // AbortSignal.timeout uses an unref'ed timer; keep this synthetic fetch alive.
  const keepAlive = setInterval(() => {}, 1000);
  try {
    await assert.rejects(slow.save(input), domain('STORAGE_TIMEOUT', 504));
    await assert.rejects(slow.readObject(key.bucket, key.prefix, key.name), domain('STORAGE_TIMEOUT', 504));
    await assert.rejects(slow.remove(ref), domain('STORAGE_TIMEOUT', 504));
  } finally { clearInterval(keepAlive); }
});

test('downloads are bounded and malformed upstream images are rejected', async () => {
  const fake = fakeStorage(); const storage = createSupabaseStorage({ ...defaults, fetch: fake.fetcher });
  const ref = await storage.save(input); const key = parseImageReference(ref)!;
  const mapKey = `${key.bucket}/${key.prefix}/${key.name}`;
  fake.objects.set(mapKey, { bytes: new Uint8Array(8 * 1024 * 1024 + 1), mimeType: 'image/png' });
  await assert.rejects(storage.readObject(key.bucket, key.prefix, key.name), domain('STORAGE_INVALID_RESPONSE', 502));
  fake.objects.set(mapKey, { bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/png' });
  await assert.rejects(storage.readObject(key.bucket, key.prefix, key.name), domain('STORAGE_INVALID_RESPONSE', 502));
});

test('provider selectors are independent and real modules never silently fall back', async () => {
  const env = { PUBLIC_BASE_URL: 'http://localhost:3011', MOCK_MODE: 'true' };
  const config = readBackendConfig({ ...env, PERSISTENCE_MODE: 'postgres', STORAGE_PROVIDER: 'supabase' }, '.');
  assert.equal(config.vision, 'mock'); assert.equal(config.mockMode, true);
  assert.throws(() => readBackendConfig({ ...env, MOCK_MODE: 'false' }, '.'), /requires real/);
  assert.throws(() => readBackendConfig({ ...env, STORAGE_PROVIDER: 'unknown' }, '.'), /STORAGE_PROVIDER/);
  assert.throws(() => readBackendConfig({ ...env, AI_PROVIDER: 'openai' }, '.'), /OPENAI_API_KEY/);
  await assert.rejects(createConfiguredBackend({ ...env, AI_PROVIDER: 'openai', OPENAI_API_KEY: 'private', OPENAI_MODEL: 'agreed-model' }, { root: '.' }), /not registered/);
  await assert.rejects(createConfiguredBackend({ ...env, MATCHING_PROVIDER: 'real' }, { root: '.' }), /not registered/);
});
