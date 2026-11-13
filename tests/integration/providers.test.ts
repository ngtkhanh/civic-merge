import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { test, type TestContext } from 'node:test';
import { DomainError, type AIAnalysis, type MatchCandidate } from '@civicmerge/contracts';
import { createConfiguredBackend, type AdapterFactories } from '../../apps/api/src/bootstrap/configured.js';
import { fakeStorage } from '../storage/helpers.js';

const analysis: AIAnalysis = { type: 'trash', severity: 'medium', description: 'Injected provider fixture', features: ['material:plastic'] };
const png = await readFile(new URL('../../mocks/images/trash.png', import.meta.url));
async function setup(t: TestContext, factories: AdapterFactories) {
  const directory = await mkdtemp(path.join(tmpdir(), 'civicmerge-providers-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const fake = fakeStorage();
  const backend = await createConfiguredBackend({ PUBLIC_BASE_URL: 'http://phone.test:3011', STORAGE_PROVIDER: 'supabase',
    SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test', SUPABASE_STORAGE_BUCKET: 'test',
    AI_PROVIDER: 'openai', MATCHING_PROVIDER: 'real', OPENAI_API_KEY: 'test-only-provider-key', OPENAI_MODEL: 'fixture-model',
    AI_TIMEOUT_MS: '20', MATCHING_TIMEOUT_MS: '20', UPLOAD_DIR: directory,
  }, { root: '.', fetch: fake.fetcher, factories });
  const server = backend.app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const analyze = (gps = true) => {
    const form = new FormData(); form.append('image', new Blob([png], { type: 'image/png' }), 'fixture.png');
    if (gps) { form.append('latitude', '10'); form.append('longitude', '106'); }
    return fetch(base + '/api/reports/analyze', { method: 'POST', body: form });
  };
  return { analyze, fake, base };
}

test('registered provider factories receive backend-only config and their output is used', async t => {
  let matched = 0;
  const { analyze, base } = await setup(t, {
    openai: config => {
      assert.deepEqual(config, { apiKey: 'test-only-provider-key', model: 'fixture-model', timeoutMs: 20 });
      return { async analyzeIncidentImage() { return analysis; } };
    }, realMatcher: () => ({ async findCandidates(input) { matched++; assert.deepEqual(input.analysis, analysis); return []; } }),
  });
  const response = await analyze(); assert.equal(response.status, 201);
  assert.deepEqual((await response.json()).analysis, analysis); assert.equal(matched, 1);
  const noGps = await (await analyze(false)).json(); assert.equal(matched, 1); assert.equal(noGps.warnings[0].code, 'GPS_UNAVAILABLE');
  const health = await (await fetch(base + '/health')).json();
  assert.equal(health.mode, 'mock', 'memory persistence prevents describing this fixture setup as a real system');
  assert.equal(health.capabilities.vision, 'openai'); assert.equal(health.capabilities.matching, 'real');
});

test('provider failure, bad schema and timeouts return structured errors before upload', async t => {
  const cases: { name: string; factories: AdapterFactories; status: number; code: string }[] = [
    { name: 'AI domain error', factories: { openai: () => ({ async analyzeIncidentImage() { throw new DomainError('IMAGE_UNSUITABLE', 'Ảnh không phù hợp.', 422); } }),
      realMatcher: () => ({ async findCandidates() { return []; } }) }, status: 422, code: 'IMAGE_UNSUITABLE' },
    { name: 'AI raw error', factories: { openai: () => ({ async analyzeIncidentImage() { throw new Error('test-only-provider-key'); } }),
      realMatcher: () => ({ async findCandidates() { return []; } }) }, status: 503, code: 'AI_UNAVAILABLE' },
    { name: 'AI schema', factories: { openai: () => ({ async analyzeIncidentImage() { return { ...analysis, type: 'invalid' } as unknown as AIAnalysis; } }),
      realMatcher: () => ({ async findCandidates() { return []; } }) }, status: 502, code: 'PROVIDER_INVALID_RESPONSE' },
    { name: 'AI timeout', factories: { openai: () => ({ analyzeIncidentImage: () => new Promise(() => {}) }),
      realMatcher: () => ({ async findCandidates() { return []; } }) }, status: 504, code: 'AI_TIMEOUT' },
    { name: 'matching error', factories: { openai: () => ({ async analyzeIncidentImage() { return analysis; } }),
      realMatcher: () => ({ async findCandidates() { throw new Error('private upstream'); } }) }, status: 503, code: 'MATCHING_UNAVAILABLE' },
    { name: 'matching schema', factories: { openai: () => ({ async analyzeIncidentImage() { return analysis; } }),
      realMatcher: () => ({ async findCandidates() { return [{ score: 9 } as MatchCandidate]; } }) }, status: 502, code: 'PROVIDER_INVALID_RESPONSE' },
    { name: 'matching timeout', factories: { openai: () => ({ async analyzeIncidentImage() { return analysis; } }),
      realMatcher: () => ({ findCandidates: () => new Promise(() => {}) }) }, status: 504, code: 'MATCHING_TIMEOUT' },
  ];
  for (const item of cases) await t.test(item.name, async sub => {
    const { analyze, fake } = await setup(sub, item.factories);
    const response = await analyze(); assert.equal(response.status, item.status);
    const text = await response.text(); assert.equal(JSON.parse(text).error.code, item.code);
    assert.doesNotMatch(text, /test-only-provider-key|private upstream/);
    assert.equal(fake.objects.size, 0);
  });
});
