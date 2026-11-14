import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { AnalyzeResponseSchema, ConfirmResponseSchema, IncidentDetailSchema } from '@civicmerge/contracts';
import { createConfiguredBackend, readBackendConfig } from '../../apps/api/src/bootstrap/configured.js';
import { loadVisionFactories } from '../../apps/api/src/bootstrap/vision-factory.js';
import { loadMatchingFactories } from '../../apps/api/src/bootstrap/matching-factory.js';

const providerKey = 'backend-test-only-key';
const analysis = { type: 'pothole', severity: 'medium', description: 'Network fixture for the actual OpenAI adapter.',
  features: ['surface:asphalt', 'shape:irregular'] };
const providerResponse = (value: unknown) => Response.json({ output: [{ type: 'message',
  content: [{ type: 'output_text', text: JSON.stringify(value) }] }] });

async function setup(t: TestContext, upstream: typeof fetch, timeoutMs?: string) {
  const directory = await mkdtemp(path.join(tmpdir(), 'civicmerge-vision-handoff-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', (input: Parameters<typeof fetch>[0], init?: RequestInit) =>
    String(input) === 'https://api.openai.com/v1/responses' ? upstream(input, init) : originalFetch(input, init));
  const env = { PUBLIC_BASE_URL: 'http://images.test', AI_PROVIDER: 'openai', OPENAI_API_KEY: providerKey,
    OPENAI_MODEL: 'fixture-vision-model', MATCHING_PROVIDER: 'real', PERSISTENCE_MODE: 'memory',
    STORAGE_PROVIDER: 'local', MOCK_MODE: 'true', UPLOAD_DIR: directory, ...(timeoutMs ? { AI_TIMEOUT_MS: timeoutMs } : {}) };
  const factories = { ...loadVisionFactories(env), ...await loadMatchingFactories(env) };
  const backend = await createConfiguredBackend(env, { root: '.', factories });
  const server = backend.app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const analyze = async (image = 'pothole-1', gps = true) => {
    const png = await readFile(new URL(`../../mocks/images/${image}.png`, import.meta.url));
    const form = new FormData(); form.append('image', new Blob([png], { type: 'image/png' }), 'client.png');
    if (gps) { form.append('latitude', '10.7769'); form.append('longitude', '106.7009'); }
    return originalFetch(base + '/api/reports/analyze', { method: 'POST', body: form });
  };
  const confirm = (body: unknown) => originalFetch(base + '/api/reports/confirm', { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { backend, base, analyze, confirm, directory, fetch: originalFetch };
}

test('OpenAI composition preserves mock selection and requires explicit key/model; default timeout is 18 seconds', async () => {
  assert.deepEqual(loadVisionFactories({ AI_PROVIDER: 'mock' }), {});
  assert.equal(typeof loadVisionFactories({ AI_PROVIDER: 'openai' }).openai, 'function');
  assert.equal(readBackendConfig({ PUBLIC_BASE_URL: 'http://test' }, '.').aiTimeoutMs, 18000);
  for (const fields of [{ OPENAI_API_KEY: '', OPENAI_MODEL: 'fixture-model' }, { OPENAI_API_KEY: providerKey, OPENAI_MODEL: '' }]) {
    await assert.rejects(createConfiguredBackend({ PUBLIC_BASE_URL: 'http://test', AI_PROVIDER: 'openai', ...fields },
      { root: '.', factories: loadVisionFactories({ AI_PROVIDER: 'openai' }) }), /Set OPENAI_API_KEY and OPENAI_MODEL privately/);
  }
});

test('actual OpenAI adapter + actual GPS matcher over HTTP; only upstream network is simulated', async t => {
  let calls = 0;
  const { backend, base, analyze, confirm, fetch } = await setup(t, async (_input, init) => {
    calls++;
    assert.equal(new Headers(init?.headers).get('authorization'), `Bearer ${providerKey}`);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, 'fixture-vision-model'); assert.equal(body.store, false);
    assert.match(body.input[0].content[1].image_url, /^data:image\/png;base64,/);
    assert.ok(init?.signal);
    return providerResponse(analysis);
  });
  const healthText = await (await fetch(base + '/health')).text();
  const health = JSON.parse(healthText); assert.equal(health.mode, 'mock');
  assert.equal(health.capabilities.vision, 'openai'); assert.equal(health.capabilities.matching, 'real');
  assert.doesNotMatch(healthText, /backend-test-only-key|fixture-vision-model/);
  const firstResponse = await analyze(); assert.equal(firstResponse.status, 201);
  const first = AnalyzeResponseSchema.parse(await firstResponse.json());
  assert.equal((await backend.repository.findReport(first.reportId))!.status, 'pending');
  assert.equal((await backend.repository.list()).length, 0);
  const create = { reportId: first.reportId, action: 'create' };
  const created = ConfirmResponseSchema.parse(await (await confirm(create)).json());
  const second = AnalyzeResponseSchema.parse(await (await analyze('pothole-2')).json());
  assert.equal(second.candidates[0].incidentId, created.incidentId); assert.equal(second.candidates[0].distanceMeters, 0);
  const merge = { reportId: second.reportId, action: 'merge', targetIncidentId: created.incidentId };
  const merged = await Promise.all(Array.from({ length: 5 }, () => confirm(merge).then(async response => {
    assert.equal(response.status, 200); return ConfirmResponseSchema.parse(await response.json());
  })));
  assert.ok(merged.every(value => value.reportCount === 2));
  assert.deepEqual(await (await confirm(create)).json(), created);
  assert.equal((await confirm({ reportId: second.reportId, action: 'create' })).status, 409);
  const detail = IncidentDetailSchema.parse(await (await fetch(`${base}/api/incidents/${created.incidentId}`)).json());
  assert.equal(detail.reportCount, 2); assert.equal(detail.reports.length, 2); assert.equal(detail.history.length, 2);
  for (const report of detail.reports) assert.equal((await fetch(base + new URL(report.imageUrl).pathname)).status, 200);
  const noGps = AnalyzeResponseSchema.parse(await (await analyze('pothole-1', false)).json());
  assert.deepEqual(noGps.candidates, []); assert.equal(noGps.warnings[0].code, 'GPS_UNAVAILABLE'); assert.equal(calls, 3);
  assert.equal((await fetch(base + '/api/mock/reset', { method: 'POST' })).status, 404);
});

test('OpenAI adapter HTTP failures keep API status/code and create no report/image', async t => {
  const cases: { name: string; upstream: typeof fetch; status: number; code: string }[] = [
    { name: 'credentials rejected upstream', upstream: async () => new Response(providerKey, { status: 401 }), status: 503, code: 'AI_UNAVAILABLE' },
    { name: 'network failure', upstream: async () => { throw new Error(providerKey); }, status: 503, code: 'AI_UNAVAILABLE' },
    { name: 'malformed output', upstream: async () => providerResponse({ ...analysis, type: 'invalid' }), status: 502, code: 'AI_INVALID_RESPONSE' },
    { name: 'unknown features', upstream: async () => providerResponse({ ...analysis, features: ['surface:road'] }), status: 502, code: 'AI_INVALID_RESPONSE' },
    { name: 'unsuitable image', upstream: async () => providerResponse({ ...analysis, description: 'UNSUITABLE_IMAGE: no incident' }), status: 422, code: 'INVALID_IMAGE' },
  ];
  for (const item of cases) await t.test(item.name, async sub => {
    const { backend, analyze, directory } = await setup(sub, item.upstream);
    let writes = 0;
    sub.mock.method(backend.repository, 'createPending', async () => { writes++; throw new Error('Unexpected write'); });
    const response = await analyze(); assert.equal(response.status, item.status);
    const text = await response.text(); assert.equal(JSON.parse(text).error.code, item.code);
    assert.doesNotMatch(text, /backend-test-only-key|fixture-vision-model/);
    assert.equal(writes, 0); assert.deepEqual(await readdir(directory), []);
  });
});

test('provider timeout aborts upstream and leaves no saved report/image', async t => {
  let aborted = false;
  const { backend, analyze, directory } = await setup(t, async (_input, init) => new Promise((_resolve, reject) => {
    init!.signal!.addEventListener('abort', () => { aborted = true; reject(init!.signal!.reason); }, { once: true });
  }), '30');
  const response = await analyze();
  const error = (await response.json()).error;
  assert.ok((response.status === 503 && error.code === 'AI_UNAVAILABLE') || (response.status === 504 && error.code === 'AI_TIMEOUT'));
  assert.equal(aborted, true); assert.deepEqual(await readdir(directory), []);
  assert.deepEqual(await backend.repository.list(), []);
});

test('startup check loads the actual factory without contacting OpenAI; process overrides private .env', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'apps/api/scripts/check-config.ts'], {
    encoding: 'utf8', timeout: 20000,
    env: { ...process.env, PUBLIC_BASE_URL: 'http://127.0.0.1:3012', AI_PROVIDER: 'openai',
      OPENAI_API_KEY: providerKey, OPENAI_MODEL: 'fixture-vision-model', PERSISTENCE_MODE: 'memory',
      STORAGE_PROVIDER: 'local', MATCHING_PROVIDER: 'real', MOCK_MODE: 'true', AI_TIMEOUT_MS: '18000' },
  });
  assert.equal(result.status, 0, 'read-only startup check should succeed with test-only process configuration');
  const health = JSON.parse(result.stdout.trim().split(/\r?\n/)[0]);
  assert.equal(health.capabilities.vision, 'openai'); assert.equal(health.capabilities.matching, 'real');
  assert.equal(health.mode, 'mock'); assert.doesNotMatch(result.stdout + result.stderr, /backend-test-only-key|fixture-vision-model/);
});
