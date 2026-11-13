import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { AnalyzeResponseSchema, IncidentDetailSchema, type IncidentRepository } from '@civicmerge/contracts';
import { createMockVision } from '@civicmerge/ai-vision';
import { mockMatcher, ruleRouter } from '@civicmerge/matching';
import { createApp } from '../../apps/api/src/app.js';
import { createConfiguredBackend } from '../../apps/api/src/bootstrap/configured.js';
import { createMemoryRepository } from '../../apps/api/src/repositories/memory.js';
import { PendingReportWriteRejected } from '../../apps/api/src/repositories/errors.js';
import { createSupabaseStorage } from '../../apps/api/src/storage/supabase.js';
import { fakeStorage } from '../storage/helpers.js';

const png = await readFile(new URL('../../mocks/images/pothole-1.png', import.meta.url));
async function setup(t: TestContext, replacement?: (repository: IncidentRepository) => IncidentRepository) {
  const directory = await mkdtemp(path.join(tmpdir(), 'civicmerge-storage-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const fake = fakeStorage(); const original = createMemoryRepository();
  const repository = replacement?.(original) ?? original;
  const storage = createSupabaseStorage({ url: 'https://project.supabase.co', secretKey: 'sb_secret_test', bucket: 'test', fetch: fake.fetcher });
  const app = createApp({ repository, storage, imageDelivery: storage, publicBaseUrl: 'http://phone-backend.test', uploadDir: directory,
    mockMode: true, vision: createMockVision(() => 'pothole'), matcher: mockMatcher, router: ruleRouter });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  t.after(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));
  const analyze = async (gps = true) => {
    const form = new FormData(); form.append('image', new Blob([png], { type: 'image/png' }), '../../client-path.png');
    if (gps) { form.append('latitude', '10.7769'); form.append('longitude', '106.7009'); }
    return fetch(base + '/api/reports/analyze', { method: 'POST', body: form });
  };
  const confirm = (body: unknown) => fetch(base + '/api/reports/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { fake, repository, original, storage, base, analyze, confirm, directory };
}

test('private Storage pipeline: two photos, one incident, proxy photos, retries, no reset, legacy local images', async t => {
  const { base, analyze, confirm, fake, repository, directory } = await setup(t);
  const first = AnalyzeResponseSchema.parse(await (await analyze()).json());
  assert.equal(first.candidates.length, 0); assert.equal((await repository.list()).length, 0);
  const request = { reportId: first.reportId, action: 'create' };
  const created = await (await confirm(request)).json();
  const second = AnalyzeResponseSchema.parse(await (await analyze()).json());
  assert.equal(second.candidates[0].incidentId, created.incidentId);
  const merge = { reportId: second.reportId, action: 'merge', targetIncidentId: created.incidentId };
  const responses = await Promise.all(Array.from({ length: 8 }, () => confirm(merge).then(r => r.json())));
  assert.ok(responses.every(r => r.reportCount === 2));
  assert.deepEqual(await (await confirm(request)).json(), created);
  assert.equal((await confirm({ reportId: first.reportId, action: 'merge', targetIncidentId: created.incidentId })).status, 409);
  const detail = IncidentDetailSchema.parse(await (await fetch(`${base}/api/incidents/${created.incidentId}`)).json());
  assert.equal(detail.reportCount, 2); assert.equal(detail.reports.length, 2); assert.equal(fake.objects.size, 2);
  for (const report of detail.reports) {
    assert.match(report.imageUrl, /^http:\/\/phone-backend.test\/api\/images\//);
    const response = await fetch(base + new URL(report.imageUrl).pathname);
    assert.equal(response.status, 200); assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
  }
  assert.match((await repository.findReport(first.reportId))!.imageUrl, /^https:\/\/civicmerge-storage.invalid\//);
  const noGps = AnalyzeResponseSchema.parse(await (await analyze(false)).json());
  assert.equal(noGps.candidates.length, 0); assert.equal(noGps.warnings[0].code, 'GPS_UNAVAILABLE');
  assert.equal((await fetch(base + '/api/mock/reset', { method: 'POST' })).status, 404);
  await writeFile(path.join(directory, 'legacy.png'), png);
  const legacy = await repository.createPending({ analysis: detail.reports[0].analysis, location: null, imageUrl: 'http://old-host/uploads/legacy.png' });
  const incident = await repository.confirm({ reportId: legacy.id, action: 'create' }, 'legacy');
  const legacyDetail = await (await fetch(`${base}/api/incidents/${incident.incidentId}`)).json();
  assert.equal(legacyDetail.reports[0].imageUrl, 'http://old-host/uploads/legacy.png');
  assert.equal((await fetch(base + '/uploads/legacy.png')).status, 200);
});

test('definite rejected insert cleans only its upload; cleanup failure preserves original HTTP error', async t => {
  const { fake, analyze } = await setup(t, repo => ({ ...repo, async createPending() { throw new PendingReportWriteRejected(); } }));
  assert.equal((await analyze()).status, 503); assert.equal(fake.objects.size, 0);
  // The next setup injects the delete failure after a successful upload.
  const second = await setup(t, repo => ({ ...repo, async createPending() {
    second.fake.state.fail = '/object/test'; throw new PendingReportWriteRejected();
  } }));
  const response = await second.analyze(); assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'DATABASE_WRITE_REJECTED');
  assert.equal(second.fake.objects.size, 1);
});

test('ambiguous insert failure or invalid response after saved report never deletes evidence', async t => {
  const uncertain = await setup(t, repo => ({ ...repo, async createPending(input) {
    await repo.createPending(input); throw new Error('connection lost after commit');
  } }));
  assert.equal((await uncertain.analyze()).status, 503); assert.equal(uncertain.fake.objects.size, 1);
  const malformed = await setup(t, repo => ({ ...repo, async createPending(input) {
    const report = await repo.createPending(input); return { ...report, id: 'invalid-id' };
  } }));
  assert.equal((await malformed.analyze()).status, 500); assert.equal(malformed.fake.objects.size, 1);
});

test('upload/provider failures create no reports; configured mixed mode is explicit and has no reset', async t => {
  const { fake, analyze } = await setup(t); fake.state.fail = '/object';
  const response = await analyze(); assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'STORAGE_UNAVAILABLE'); assert.equal(fake.objects.size, 0);
  const directory = await mkdtemp(path.join(tmpdir(), 'civicmerge-mixed-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const remote = fakeStorage();
  const backend = await createConfiguredBackend({ PUBLIC_BASE_URL: 'http://localhost:3011', STORAGE_PROVIDER: 'supabase',
    SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test', SUPABASE_STORAGE_BUCKET: 'test',
    UPLOAD_DIR: directory }, { root: '.', fetch: remote.fetcher });
  const server = backend.app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const health = await (await fetch(base + '/health')).json();
  assert.equal(health.mode, 'mock'); assert.deepEqual(health.capabilities, { persistence: 'memory', storage: 'supabase', vision: 'mock', matching: 'mock' });
  assert.equal((await fetch(base + '/api/mock/reset', { method: 'POST' })).status, 404);
});
