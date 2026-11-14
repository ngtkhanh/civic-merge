import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  AnalyzeResponseSchema, ConfirmResponseSchema, IncidentDetailSchema, IncidentListResponseSchema,
  type DuplicateMatcher,
} from '@civicmerge/contracts';
import { createGpsFeatureMatcher, ruleRouter } from '@civicmerge/matching';
import { createApp } from '../../apps/api/src/app.js';
import { createMemoryRepository } from '../../apps/api/src/repositories/memory.js';
import { createLocalStorage } from '../../apps/api/src/storage/local.js';
import { analysis, origin, atMeters, incident } from '../fixtures/matching.js';

async function setup(t: TestContext, matcher = createGpsFeatureMatcher()) {
  const uploadDir = await mkdtemp(path.join(tmpdir(), 'civicmerge-matching-'));
  const repository = createMemoryRepository();
  let visionAnalysis = structuredClone(analysis);
  let matcherCalls = 0;
  const app = createApp({
    uploadDir, repository, mockMode: true,
    storage: createLocalStorage(uploadDir, 'http://images.test'), router: ruleRouter,
    vision: { async analyzeIncidentImage() { return structuredClone(visionAnalysis); } },
    matcher: { async findCandidates(input) { matcherCalls++; return matcher.findCandidates(input); } },
  });
  const server = app.listen(0, '127.0.0.1');
  t.after(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(uploadDir, { recursive: true, force: true });
  });
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const post = (route: string, body: unknown) => fetch(base + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const analyze = async (location: typeof origin | null = origin, image = 'pothole-1') => {
    const form = new FormData();
    const bytes = await readFile(new URL(`../../mocks/images/${image}.png`, import.meta.url));
    form.append('image', new Blob([new Uint8Array(bytes)], { type: 'image/png' }), 'client-name.png');
    if (location) {
      form.append('latitude', String(location.latitude));
      form.append('longitude', String(location.longitude));
    }
    return fetch(base + '/api/reports/analyze', { method: 'POST', body: form });
  };
  const list = async () => IncidentListResponseSchema.parse(await (await fetch(base + '/api/incidents')).json()).incidents;
  return { base, post, analyze, list, repository, uploadDir, calls: () => matcherCalls,
    setAnalysis(value: typeof analysis) { visionAnalysis = value; } };
}

test('real matching over HTTP: pending -> create -> nearby proposal -> concurrent merge/retry', async t => {
  const { base, post, analyze, list, repository } = await setup(t);
  const response = await analyze();
  assert.equal(response.status, 201);
  const first = AnalyzeResponseSchema.parse(await response.json());
  assert.deepEqual(first.candidates, []);
  assert.equal((await repository.findReport(first.reportId))?.status, 'pending');
  assert.equal((await list()).length, 0);
  const create = { reportId: first.reportId, action: 'create' };
  const created = ConfirmResponseSchema.parse(await (await post('/api/reports/confirm', create)).json());
  const second = AnalyzeResponseSchema.parse(await (await analyze(atMeters(10), 'pothole-2')).json());
  assert.equal(second.candidates[0].incidentId, created.incidentId);
  assert.equal(second.candidates[0].distanceMeters, 10);
  assert.equal(second.candidates[0].score, Number((0.7 / 1.1 + 0.3).toFixed(4)));
  assert.equal((await list())[0].reportCount, 1, 'proposal must not attach the pending report');
  const merge = { reportId: second.reportId, action: 'merge', targetIncidentId: created.incidentId };
  const responses = await Promise.all([post('/api/reports/confirm', merge), post('/api/reports/confirm', merge)]);
  responses.forEach(value => assert.equal(value.status, 200));
  const merged = ConfirmResponseSchema.parse(await responses[0].json());
  assert.equal(merged.reportCount, 2);
  assert.deepEqual(await responses[1].json(), merged);
  assert.deepEqual(await (await post('/api/reports/confirm', create)).json(), created);
  assert.equal((await post('/api/reports/confirm', { reportId: second.reportId, action: 'create' })).status, 409);
  assert.equal((await post('/api/reports/confirm', { ...merge, targetIncidentId: incident(99).id })).status, 409);
  const detail = IncidentDetailSchema.parse(await (await fetch(`${base}/api/incidents/${created.incidentId}`)).json());
  assert.equal(detail.reports.length, 2);
  assert.equal(detail.history.length, 2);
  assert.ok(detail.reports.every(report => report.status === 'confirmed' && report.incidentId === detail.id));
  assert.equal(new Set(detail.reports.map(report => report.imageUrl)).size, 2);
  for (const report of detail.reports) assert.equal((await fetch(base + new URL(report.imageUrl).pathname)).status, 200);
  assert.equal((await list()).length, 1);
});

test('HTTP excludes far/different types; missing GPS bypasses matcher; invalid targets stay pending', async t => {
  const ctx = await setup(t);
  const first = AnalyzeResponseSchema.parse(await (await ctx.analyze()).json());
  const created = ConfirmResponseSchema.parse(await (await ctx.post('/api/reports/confirm', { reportId: first.reportId, action: 'create' })).json());
  const far = AnalyzeResponseSchema.parse(await (await ctx.analyze(atMeters(101))).json());
  assert.deepEqual(far.candidates, []);
  ctx.setAnalysis({ ...analysis, type: 'trash' });
  const trash = AnalyzeResponseSchema.parse(await (await ctx.analyze()).json());
  assert.deepEqual(trash.candidates, []);
  assert.equal((await ctx.post('/api/reports/confirm', { reportId: trash.reportId, action: 'merge', targetIncidentId: created.incidentId })).status, 409);
  assert.equal((await ctx.post('/api/reports/confirm', { reportId: trash.reportId, action: 'merge', targetIncidentId: incident(99).id })).status, 404);
  assert.equal((await ctx.repository.findReport(trash.reportId))?.status, 'pending');
  const before = ctx.calls();
  const noGps = AnalyzeResponseSchema.parse(await (await ctx.analyze(null)).json());
  assert.equal(ctx.calls(), before);
  assert.deepEqual(noGps.candidates, []);
  assert.equal(noGps.warnings[0].code, 'GPS_UNAVAILABLE');
  assert.equal((await ctx.post('/api/reports/confirm', { reportId: noGps.reportId, action: 'create' })).status, 200);
});

for (const failure of ['throw', 'invalid output'] as const) {
  test(`HTTP matcher ${failure} saves neither image nor pending report`, async t => {
    let pendingWrites = 0;
    const matcher: DuplicateMatcher = { async findCandidates() {
      if (failure === 'throw') throw new Error('test matcher failure');
      return [{ incidentId: incident().id, score: 2, distanceMeters: 0, reasons: [] }];
    } };
    const ctx = await setup(t, matcher);
    const createPending = ctx.repository.createPending.bind(ctx.repository);
    ctx.repository.createPending = async input => { pendingWrites++; return createPending(input); };
    const before = await readdir(ctx.uploadDir);
    const response = await ctx.analyze();
    assert.equal(response.status, failure === 'throw' ? 503 : 502);
    assert.equal((await response.json()).error.code, failure === 'throw' ? 'MATCHING_UNAVAILABLE' : 'PROVIDER_INVALID_RESPONSE');
    assert.equal(pendingWrites, 0);
    assert.deepEqual(await readdir(ctx.uploadDir), before);
    assert.deepEqual(await ctx.list(), []);
  });
}
