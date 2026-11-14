import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { DomainError, type AIAnalysis, type IncidentDetail } from '@civicmerge/contracts';
import { createMockVision } from '@civicmerge/ai-vision';
import { mockMatcher, ruleRouter } from '@civicmerge/matching';
import { createApp } from '../../apps/api/src/app.js';
import { createMemoryRepository } from '../../apps/api/src/repositories/memory.js';
import { createLocalStorage } from '../../apps/api/src/storage/local.js';

const analysis: AIAnalysis = { type: 'pothole', severity: 'medium', description: 'Resolved policy fixture', features: [] };
test('memory resolved policy preserves pending/incident and prioritizes old create/merge snapshots', async () => {
  const incidents = new Map<string, IncidentDetail>();
  const repo = createMemoryRepository({ incidents });
  const pending = () => repo.createPending({ analysis, location: null, imageUrl: `http://images.test/${randomUUID()}.jpg` });
  const first = await pending(); const create = { reportId: first.id, action: 'create' as const };
  const created = await repo.confirm(create, 'fixture-team');
  const second = await pending(); const merge = { reportId: second.id, action: 'merge' as const, targetIncidentId: created.incidentId };
  const merged = await repo.confirm(merge, 'ignored-team');
  incidents.get(created.incidentId)!.status = 'resolved';
  const before = await repo.get(created.incidentId);
  const third = await pending();
  const rejected = await Promise.allSettled(Array.from({ length: 6 }, () => repo.confirm({ reportId: third.id, action: 'merge', targetIncidentId: created.incidentId }, 'fixture-team')));
  for (const result of rejected) {
    assert.equal(result.status, 'rejected');
    if (result.status === 'rejected') { assert.ok(result.reason instanceof DomainError); assert.equal(result.reason.code, 'INCIDENT_RESOLVED'); assert.equal(result.reason.status, 409); }
  }
  assert.equal((await repo.findReport(third.id))!.status, 'pending');
  assert.deepEqual(await repo.get(created.incidentId), before);
  assert.deepEqual(await repo.confirm(create, 'changed-team'), created);
  assert.deepEqual(await repo.confirm(merge, 'changed-team'), merged);
  await assert.rejects(repo.confirm({ reportId: second.id, action: 'create' }, 'fixture-team'), { code: 'REPORT_ALREADY_CONFIRMED' });
  const replacement = await repo.confirm({ reportId: third.id, action: 'create' }, 'fixture-team');
  assert.notEqual(replacement.incidentId, created.incidentId); assert.equal((await repo.get(created.incidentId))!.status, 'resolved');
  incidents.get(replacement.incidentId)!.status = 'in_progress';
  const fourth = await pending();
  await repo.confirm({ reportId: fourth.id, action: 'merge', targetIncidentId: replacement.incidentId }, 'fixture-team');
  assert.equal((await repo.get(replacement.incidentId))!.status, 'in_progress');
});

test('HTTP: incident resolved after analyze rejects merge, keeps pending, permits create and old retry', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'civicmerge-resolved-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const incidents = new Map<string, IncidentDetail>(); const repository = createMemoryRepository({ incidents });
  const app = createApp({ repository, storage: createLocalStorage(directory, 'http://images.test'), uploadDir: directory,
    mockMode: true, vision: createMockVision(() => 'pothole'), matcher: mockMatcher, router: ruleRouter });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));
  const address = server.address(); assert.ok(address && typeof address !== 'string'); const base = `http://127.0.0.1:${address.port}`;
  const post = (body: unknown) => fetch(base + '/api/reports/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const png = await readFile(new URL('../../mocks/images/pothole-1.png', import.meta.url));
  const analyze = async () => {
    const form = new FormData(); form.append('image', new Blob([png], { type: 'image/png' }), 'fixture.png');
    form.append('latitude', '10.7769'); form.append('longitude', '106.7009');
    const response = await fetch(base + '/api/reports/analyze', { method: 'POST', body: form });
    assert.equal(response.status, 201); return response.json();
  };
  const first = await analyze(); const create = { reportId: first.reportId, action: 'create' };
  const created = await (await post(create)).json();
  const second = await analyze(); assert.equal(second.candidates[0].incidentId, created.incidentId);
  incidents.get(created.incidentId)!.status = 'resolved';
  const before = await repository.get(created.incidentId);
  const response = await post({ reportId: second.reportId, action: 'merge', targetIncidentId: created.incidentId });
  assert.equal(response.status, 409); assert.equal((await response.json()).error.code, 'INCIDENT_RESOLVED');
  assert.equal((await repository.findReport(second.reportId))!.status, 'pending');
  assert.deepEqual(await repository.get(created.incidentId), before);
  assert.deepEqual(await (await post(create)).json(), created);
  assert.equal((await post({ reportId: second.reportId, action: 'create' })).status, 200);
  assert.equal((await repository.get(created.incidentId))!.status, 'resolved');
});
