import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AnalyzeResponseSchema, ApiErrorSchema, ConfirmResponseSchema, IncidentDetailSchema, IncidentListResponseSchema } from '@civicmerge/contracts';
import { createMockApp } from '../../apps/api/src/bootstrap/mock.js';

async function setup(t: TestContext, mockMode = true) {
  const uploadDir = await mkdtemp(path.join(tmpdir(), 'civicmerge-test-'));
  const { app, repository } = createMockApp({ uploadDir, publicBaseUrl: 'http://images.test', mockMode });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(uploadDir, { recursive: true, force: true });
  });
  const post = (route: string, data?: unknown) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  const analyze = async (options: { image?: string; location?: boolean; latitude?: string; longitude?: string; bytes?: Uint8Array; mime?: string } = {}) => {
    const form = new FormData();
    const bytes = options.bytes ?? await readFile(new URL(`../../mocks/images/${options.image ?? 'pothole-1'}.png`, import.meta.url));
    form.append('image', new Blob([new Uint8Array(bytes)], { type: options.mime ?? 'image/png' }), 'untrusted-name.png');
    if (options.location !== false) {
      form.append('latitude', options.latitude ?? '10.7769'); form.append('longitude', options.longitude ?? '106.7009');
    }
    return fetch(base + '/api/reports/analyze', { method: 'POST', body: form });
  };
  return { base, repository, post, analyze, uploadDir };
}

test('two images -> one incident, two reports; repeat/concurrent confirmations are idempotent', async t => {
  const { base, post, analyze } = await setup(t);
  const firstResponse = await analyze(); assert.equal(firstResponse.status, 201);
  const first = AnalyzeResponseSchema.parse(await firstResponse.json());
  assert.equal(first.candidates.length, 0);
  let list = IncidentListResponseSchema.parse(await (await fetch(base + '/api/incidents')).json());
  assert.equal(list.incidents.length, 0, 'analyze must not create an incident');
  const create = { reportId: first.reportId, action: 'create' };
  const results = await Promise.all([post('/api/reports/confirm', create), post('/api/reports/confirm', create)]);
  for (const result of results) assert.equal(result.status, 200);
  const created = ConfirmResponseSchema.parse(await results[0].json());
  assert.deepEqual(await results[1].json(), created);
  const second = AnalyzeResponseSchema.parse(await (await analyze({ image: 'pothole-2' })).json());
  assert.equal(second.candidates[0].incidentId, created.incidentId);
  const merge = { reportId: second.reportId, action: 'merge', targetIncidentId: created.incidentId };
  const merged = ConfirmResponseSchema.parse(await (await post('/api/reports/confirm', merge)).json());
  assert.equal(merged.reportCount, 2);
  assert.deepEqual(await (await post('/api/reports/confirm', merge)).json(), merged);
  assert.deepEqual(await (await post('/api/reports/confirm', create)).json(), created, 'retry returns original snapshot even after later merges');
  assert.equal((await post('/api/reports/confirm', { reportId: second.reportId, action: 'create' })).status, 409);
  const detail = IncidentDetailSchema.parse(await (await fetch(`${base}/api/incidents/${created.incidentId}`)).json());
  assert.equal(detail.reports.length, 2); assert.equal(detail.history.length, 2);
  assert.ok(detail.reports.every(report => report.incidentId === detail.id && report.status === 'confirmed'));
  assert.notEqual(detail.reports[0].imageUrl, detail.reports[1].imageUrl);
  for (const report of detail.reports) {
    const image = await fetch(base + new URL(report.imageUrl).pathname);
    assert.equal(image.status, 200); assert.match(image.headers.get('content-type')!, /image\/png/);
  }
  list = IncidentListResponseSchema.parse(await (await fetch(base + '/api/incidents')).json());
  assert.equal(list.incidents.length, 1); assert.equal(list.incidents[0].reportCount, 2);
});

test('different type is not a candidate; invalid targets leave report pending', async t => {
  const { post, analyze, repository } = await setup(t);
  const first = AnalyzeResponseSchema.parse(await (await analyze()).json());
  const created = ConfirmResponseSchema.parse(await (await post('/api/reports/confirm', { reportId: first.reportId, action: 'create' })).json());
  await post('/api/mock/scenario', { scenario: 'trash' });
  const trash = AnalyzeResponseSchema.parse(await (await analyze({ image: 'trash' })).json());
  assert.equal(trash.candidates.length, 0);
  assert.equal((await post('/api/reports/confirm', { reportId: trash.reportId, action: 'merge', targetIncidentId: created.incidentId })).status, 409);
  assert.equal((await post('/api/reports/confirm', { reportId: trash.reportId, action: 'merge', targetIncidentId: randomUUID() })).status, 404);
  assert.equal((await repository.findReport(trash.reportId))?.status, 'pending');
  assert.equal((await post('/api/reports/confirm', { reportId: trash.reportId, action: 'merge' })).status, 400);
  const confirmed = ConfirmResponseSchema.parse(await (await post('/api/reports/confirm', { reportId: trash.reportId, action: 'create' })).json());
  assert.match(confirmed.assignedTeam, /vệ sinh/);
});

test('GPS denial still allows create; AI failure and malformed input do not save images', async t => {
  const { post, analyze, uploadDir } = await setup(t);
  const noGps = AnalyzeResponseSchema.parse(await (await analyze({ location: false })).json());
  assert.equal(noGps.candidates.length, 0); assert.equal(noGps.warnings[0].code, 'GPS_UNAVAILABLE');
  assert.equal((await post('/api/reports/confirm', { reportId: noGps.reportId, action: 'create' })).status, 200);
  const before = (await readdir(uploadDir)).length;
  await post('/api/mock/scenario', { scenario: 'ai-error' });
  const failure = await analyze(); assert.equal(failure.status, 503);
  assert.equal(ApiErrorSchema.parse(await failure.json()).error.code, 'AI_UNAVAILABLE');
  assert.equal((await readdir(uploadDir)).length, before);
  assert.equal((await analyze({ latitude: '91' })).status, 400);
  assert.equal((await analyze({ longitude: '' })).status, 400);
  assert.equal((await analyze({ bytes: new TextEncoder().encode('not an image') })).status, 415);
  assert.equal((await analyze({ bytes: new Uint8Array(8 * 1024 * 1024 + 1) })).status, 413);
});

test('reset clears the running repository, restores scenario and supports replay', async t => {
  const { post, analyze, base, repository } = await setup(t);
  const report = AnalyzeResponseSchema.parse(await (await analyze()).json());
  await post('/api/reports/confirm', { reportId: report.reportId, action: 'create' });
  await post('/api/mock/scenario', { scenario: 'flood' });
  assert.equal((await post('/api/mock/reset')).status, 200);
  assert.deepEqual(await (await fetch(base + '/api/incidents')).json(), { incidents: [] });
  assert.equal(await repository.findReport(report.reportId), null);
  const again = AnalyzeResponseSchema.parse(await (await analyze()).json());
  assert.equal(again.analysis.type, 'pothole'); assert.equal(again.candidates.length, 0);
});

test('mock controls are absent when mock mode is disabled', async t => {
  const { post, base } = await setup(t, false);
  assert.equal((await post('/api/mock/reset')).status, 404);
  assert.equal((await post('/api/mock/scenario', { scenario: 'trash' })).status, 404);
  assert.equal((await fetch(base + '/api/mock/state')).status, 404);
});
