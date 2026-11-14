import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadMatchingFactories } from '../../apps/api/src/bootstrap/matching-factory.js';
import { createConfiguredBackend } from '../../apps/api/src/bootstrap/configured.js';

test('matcher factory loader keeps mock untouched, rejects absent/invalid export, injects handed-off defaults', async () => {
  let imports = 0;
  assert.deepEqual(await loadMatchingFactories({ MATCHING_PROVIDER: 'mock' }, async () => { imports++; return {}; }), {});
  assert.equal(imports, 0);
  await assert.rejects(loadMatchingFactories({ MATCHING_PROVIDER: 'real' }, async () => ({})), /createGpsFeatureMatcher export/);
  const bad = await loadMatchingFactories({ MATCHING_PROVIDER: 'real' }, async () => ({ createGpsFeatureMatcher: () => ({}) }));
  assert.throws(() => bad.realMatcher!(), /DuplicateMatcher/);
  const matcherFixture = { async findCandidates() { return []; } };
  const injected = await loadMatchingFactories({ MATCHING_PROVIDER: 'real' }, async () => ({ createGpsFeatureMatcher: (options: unknown) => {
    assert.deepEqual(options, { radiusMeters: 100, maxCandidates: 3 }); return matcherFixture;
  } }));
  assert.equal(injected.realMatcher!(), matcherFixture);
});

const matchingModule: object = await import('@civicmerge/matching');
const hasRealMatcher = 'createGpsFeatureMatcher' in matchingModule && typeof matchingModule.createGpsFeatureMatcher === 'function';
test('actual handed-off GPS/features matcher through configured HTTP server (no algorithm substitute)', {
  skip: hasRealMatcher ? false : 'Member 4 source is not available locally: createGpsFeatureMatcher export missing. Factory fixture test does not prove real matching.',
}, async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'civicmerge-real-matcher-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const factories = await loadMatchingFactories({ MATCHING_PROVIDER: 'real' });
  const backend = await createConfiguredBackend({ PUBLIC_BASE_URL: 'http://images.test', MATCHING_PROVIDER: 'real', AI_PROVIDER: 'mock',
    PERSISTENCE_MODE: 'memory', STORAGE_PROVIDER: 'local', MOCK_MODE: 'true', UPLOAD_DIR: directory }, { root: '.', factories });
  const server = backend.app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));
  const address = server.address(); assert.ok(address && typeof address !== 'string'); const base = `http://127.0.0.1:${address.port}`;
  const health = await (await fetch(base + '/health')).json(); assert.equal(health.mode, 'mock'); assert.equal(health.capabilities.matching, 'real');
  const png = await readFile(new URL('../../mocks/images/pothole-1.png', import.meta.url));
  const analyze = async (latitude: string | null) => {
    const form = new FormData(); form.append('image', new Blob([png], { type: 'image/png' }), 'fixture.png');
    if (latitude !== null) { form.append('latitude', latitude); form.append('longitude', '106.7009'); }
    const response = await fetch(base + '/api/reports/analyze', { method: 'POST', body: form }); assert.equal(response.status, 201); return response.json();
  };
  const confirm = (body: unknown) => fetch(base + '/api/reports/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const first = await analyze('10.7769'); assert.equal(first.candidates.length, 0);
  const create = { reportId: first.reportId, action: 'create' };
  const created = await (await confirm(create)).json();
  const second = await analyze('10.77691'); assert.equal(second.candidates[0].incidentId, created.incidentId);
  assert.ok(second.candidates[0].distanceMeters >= 0 && second.candidates[0].distanceMeters < 10, 'actual distance must not be fixed mock 12m');
  const merge = { reportId: second.reportId, action: 'merge', targetIncidentId: created.incidentId };
  const merged = await Promise.all(Array.from({ length: 5 }, () => confirm(merge).then(r => r.json())));
  assert.ok(merged.every(r => r.reportCount === 2)); assert.deepEqual(await (await confirm(create)).json(), created);
  assert.equal((await confirm({ reportId: second.reportId, action: 'create' })).status, 409);
  const far = await analyze('10.8'); assert.equal(far.candidates.length, 0);
  const noGps = await analyze(null); assert.equal(noGps.candidates.length, 0); assert.equal(noGps.warnings[0].code, 'GPS_UNAVAILABLE');
  const detail = await (await fetch(`${base}/api/incidents/${created.incidentId}`)).json();
  assert.equal(detail.reports.length, 2); assert.equal(detail.history.length, 2);
  for (const report of detail.reports) assert.equal((await fetch(base + new URL(report.imageUrl).pathname)).status, 200);
  assert.equal((await fetch(base + '/api/mock/state')).status, 404);
});
