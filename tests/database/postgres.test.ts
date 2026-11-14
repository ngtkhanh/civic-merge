import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  AnalyzeResponseSchema, ConfirmResponseSchema, DomainError,
  type AIAnalysis, type ConfirmRequest, type ConfirmResponse,
} from '@civicmerge/contracts';
import { createDatabasePool } from '../../apps/api/src/database/pool.js';
import { migrateDatabase } from '../../apps/api/src/database/migrate.js';
import { createPostgresRepository } from '../../apps/api/src/repositories/postgres.js';
import { createPostgresApp } from '../../apps/api/src/bootstrap/postgres.js';
import { createConfiguredBackend } from '../../apps/api/src/bootstrap/configured.js';
import { loadVisionFactories } from '../../apps/api/src/bootstrap/vision-factory.js';
import { loadMatchingFactories } from '../../apps/api/src/bootstrap/matching-factory.js';
import { fakeStorage } from '../storage/helpers.js';

const analysis: AIAnalysis = { type: 'pothole', severity: 'high', description: 'Database test', features: ['surface:asphalt'] };
const team = 'Test road team';
const noDatabase = !process.env.TEST_DATABASE_URL;

test('PostgreSQL configuration rejects missing credentials and TLS URL overrides', () => {
  assert.throws(() => createDatabasePool({}), /DATABASE_URL/);
  assert.throws(() => createDatabasePool({ DATABASE_URL: 'not-a-url' }), /Invalid DATABASE_URL/);
  assert.throws(() => createDatabasePool({ DATABASE_URL: 'https://db.test' }), /protocol/);
  assert.throws(() => createDatabasePool({ DATABASE_URL: 'postgresql://db.test/test?sslmode=require' }), /Remove SSL/);
  assert.throws(() => createDatabasePool({ DATABASE_URL: 'postgresql://db.test/test', DATABASE_SSL: 'insecure' }), /DATABASE_SSL/);
});

test('PostgreSQL migrations, persistence, atomic confirmation and concurrency', {
  skip: noDatabase ? 'TEST_DATABASE_URL missing; no database connected or modified.' : false,
  timeout: 120000,
}, async t => {
  assert.equal(process.env.CIVICMERGE_DB_TEST, 'isolated', 'Set CIVICMERGE_DB_TEST=isolated for a disposable test database only.');
  const url = new URL(process.env.TEST_DATABASE_URL!);
  assert.match(decodeURIComponent(url.pathname.slice(1)), /^civicmerge_test_[a-z0-9_]+$/, 'Refusing a non-test database URL.');
  const pool = createDatabasePool(process.env, 'TEST_DATABASE_URL');
  const guard = await pool.connect();
  t.after(async () => { guard.release(); await pool.end(); });
  const database = await guard.query('SELECT current_database() AS name, pg_try_advisory_lock(728174632) AS locked');
  assert.match(database.rows[0].name, /^civicmerge_test_[a-z0-9_]+$/);
  assert.equal(database.rows[0].locked, true, 'Another test run owns this database.');
  const existing = await guard.query(`SELECT count(*)::int AS count FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'civicmerge'`);
  assert.equal(existing.rows[0].count, 0, 'Use a fresh test database; tests never reset existing CivicMerge data.');
  // Test data is retained for inspection. No DROP/TRUNCATE/DELETE/reset cleanup.
  const repository = createPostgresRepository(pool);
  const peerPool = createDatabasePool(process.env, 'TEST_DATABASE_URL');
  t.after(() => peerPool.end());
  const peer = createPostgresRepository(peerPool);
  const pending = (type: AIAnalysis['type'] = 'pothole') => repository.createPending({
    analysis: { ...analysis, type }, location: null, imageUrl: `http://images.test/${randomUUID()}.png`,
  });
  const counts = async () => (await pool.query(`SELECT
    (SELECT count(*)::int FROM civicmerge.incidents) AS incidents,
    (SELECT count(*)::int FROM civicmerge.reports) AS reports,
    (SELECT count(*)::int FROM civicmerge.history) AS history,
    (SELECT count(*)::int FROM civicmerge.confirmations) AS confirmations`)).rows[0];
  const expectDomain = (code: string, status: number) => (error: unknown) => {
    assert.ok(error instanceof DomainError); assert.equal(error.code, code); assert.equal(error.status, status); return true;
  };

  await t.test('migration is repeatable and tables have RLS enabled', async () => {
    assert.deepEqual(await migrateDatabase(pool), ['202611130001_incident_repository.sql']);
    assert.deepEqual(await migrateDatabase(pool), []);
    const tables = await pool.query(`SELECT c.relname, c.relrowsecurity FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'civicmerge' AND c.relkind = 'r'`);
    assert.equal(tables.rows.length, 5);
    assert.ok(tables.rows.every(row => row.relrowsecurity));
    assert.deepEqual(await counts(), { incidents: 0, reports: 0, history: 0, confirmations: 0 });
  });

  const first = await pending();
  const create: ConfirmRequest = { reportId: first.id, action: 'create' };
  let original: ReturnType<typeof ConfirmResponseSchema.parse>;
  await t.test('same report confirmed concurrently creates exactly one incident and snapshot', async () => {
    assert.equal(first.status, 'pending'); assert.equal(first.incidentId, null);
    assert.equal((await repository.list()).length, 0);
    const responses = await Promise.all(Array.from({ length: 12 }, (_, i) => (i % 2 ? peer : repository).confirm(create, team)));
    original = responses[0];
    assert.equal(original.reportCount, 1);
    assert.ok(responses.every(value => JSON.stringify(value) === JSON.stringify(original)));
    assert.deepEqual(await counts(), { incidents: 1, reports: 1, history: 1, confirmations: 1 });
  });

  const second = await pending();
  const merge: ConfirmRequest = { reportId: second.id, action: 'merge', targetIncidentId: original!.incidentId };
  let mergeSnapshot: ReturnType<typeof ConfirmResponseSchema.parse>;
  await t.test('same merge concurrently adds one report; existing team and create snapshot remain unchanged', async () => {
    const responses = await Promise.all(Array.from({ length: 12 }, (_, i) => (i % 2 ? peer : repository).confirm(merge, 'ignored new team')));
    mergeSnapshot = responses[0];
    assert.equal(mergeSnapshot.reportCount, 2); assert.equal(mergeSnapshot.assignedTeam, team);
    for (const response of responses) assert.deepEqual(response, mergeSnapshot);
    assert.deepEqual(await peer.confirm(create, 'changed routing result'), original!);
    assert.deepEqual(await counts(), { incidents: 1, reports: 2, history: 2, confirmations: 2 });
  });

  await t.test('many independent reports merge concurrently without lost counts or inconsistent detail', async () => {
    const reports = await Promise.all(Array.from({ length: 24 }, () => pending()));
    const confirmations = Promise.all(reports.map((report, i) => (i % 2 ? peer : repository).confirm({
      reportId: report.id, action: 'merge', targetIncidentId: original!.incidentId,
    }, team)));
    for (let i = 0; i < 8; i++) {
      const detail = (await peer.get(original!.incidentId))!;
      assert.equal(detail.reportCount, detail.reports.length);
      assert.equal(detail.reportCount, detail.history.length);
    }
    const responses = await confirmations;
    assert.deepEqual(responses.map(response => response.reportCount).sort((a, b) => a - b), Array.from({ length: 24 }, (_, i) => i + 3));
    const detail = (await repository.get(original!.incidentId))!;
    assert.equal(detail.reportCount, 26); assert.equal(detail.reports.length, 26); assert.equal(detail.history.length, 26);
    assert.equal(new Set(detail.reports.map(report => report.id)).size, 26);
    assert.ok(detail.reports.every(report => report.status === 'confirmed' && report.incidentId === original!.incidentId));
    assert.deepEqual(await repository.confirm(create, team), original!);
    assert.deepEqual(await repository.confirm(merge, team), mergeSnapshot!);
    assert.deepEqual(await counts(), { incidents: 1, reports: 26, history: 26, confirmations: 26 });
  });

  await t.test('changed action or target conflicts, including a now nonexistent target', async () => {
    await assert.rejects(peer.confirm({ reportId: first.id, action: 'merge', targetIncidentId: original!.incidentId }, team), expectDomain('REPORT_ALREADY_CONFIRMED', 409));
    await assert.rejects(repository.confirm({ reportId: second.id, action: 'create' }, team), expectDomain('REPORT_ALREADY_CONFIRMED', 409));
    await assert.rejects(repository.confirm({ ...merge, targetIncidentId: randomUUID() }, team), expectDomain('REPORT_ALREADY_CONFIRMED', 409));
  });

  await t.test('competing choices for the same report produce one winner and one conflict', async () => {
    const report = await pending();
    const results = await Promise.allSettled([
      repository.confirm({ reportId: report.id, action: 'create' }, team),
      peer.confirm({ reportId: report.id, action: 'merge', targetIncidentId: original!.incidentId }, team),
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const failure = results.find(result => result.status === 'rejected');
    assert.ok(failure && failure.status === 'rejected'); expectDomain('REPORT_ALREADY_CONFIRMED', 409)(failure.reason);
    const events = await pool.query('SELECT count(*)::int AS count FROM civicmerge.history WHERE report_id = $1', [report.id]);
    assert.equal(events.rows[0].count, 1);
    assert.equal((await peer.findReport(report.id))?.status, 'confirmed');
  });

  await t.test('invalid targets roll back without consuming pending reports; retry create succeeds', async () => {
    const report = await pending('trash');
    const before = await counts();
    await assert.rejects(repository.confirm({ reportId: report.id, action: 'merge', targetIncidentId: original!.incidentId }, team), expectDomain('INCIDENT_TYPE_MISMATCH', 409));
    await assert.rejects(peer.confirm({ reportId: report.id, action: 'merge', targetIncidentId: randomUUID() }, team), expectDomain('INCIDENT_NOT_FOUND', 404));
    assert.equal((await peer.findReport(report.id))?.status, 'pending');
    assert.equal((await peer.findReport(report.id))?.incidentId, null);
    assert.deepEqual(await counts(), before);
    await repository.confirm({ reportId: report.id, action: 'create' }, 'Test sanitation team');
    await assert.rejects(repository.confirm({ reportId: randomUUID(), action: 'create' }, team), expectDomain('REPORT_NOT_FOUND', 404));
  });

  await t.test('failure saving snapshot rolls back incident, report link, count and history', async () => {
    const createReport = await pending(); const mergeReport = await pending();
    const before = await counts(); const detailBefore = await repository.get(original!.incidentId);
    // A real PostgreSQL failure after all earlier writes, in this fresh test DB only.
    await pool.query(`CREATE FUNCTION civicmerge.test_reject_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'test snapshot failure' USING ERRCODE = '23514'; END; $$`);
    await pool.query(`CREATE TRIGGER test_reject_snapshot BEFORE INSERT ON civicmerge.confirmations
      FOR EACH ROW EXECUTE FUNCTION civicmerge.test_reject_snapshot()`);
    try {
      await assert.rejects(repository.confirm({ reportId: createReport.id, action: 'create' }, team), { code: '23514' });
      await assert.rejects(peer.confirm({ reportId: mergeReport.id, action: 'merge', targetIncidentId: original!.incidentId }, team), { code: '23514' });
      assert.deepEqual(await counts(), before);
      assert.deepEqual(await repository.get(original!.incidentId), detailBefore);
      for (const report of [createReport, mergeReport]) {
        assert.deepEqual(await repository.findReport(report.id), report);
      }
    } finally {
      await pool.query('DROP TRIGGER test_reject_snapshot ON civicmerge.confirmations');
      await pool.query('DROP FUNCTION civicmerge.test_reject_snapshot()');
    }
    await repository.confirm({ reportId: mergeReport.id, action: 'merge', targetIncidentId: original!.incidentId }, team);
  });

  await t.test('fresh connection retains data and original snapshots; invalid runtime input is rejected', async () => {
    const restartedPool = createDatabasePool(process.env, 'TEST_DATABASE_URL');
    try {
      const restarted = createPostgresRepository(restartedPool);
      assert.deepEqual(await restarted.confirm(create, team), original!);
      assert.deepEqual(await restarted.confirm(merge, team), mergeSnapshot!);
      assert.ok((await restarted.get(original!.incidentId))!.reportCount > mergeSnapshot!.reportCount);
      assert.equal(await restarted.get('invalid-id'), null);
      assert.equal(await restarted.findReport(randomUUID()), null);
      await assert.rejects(restarted.createPending({ analysis, location: { latitude: 91, longitude: 0 }, imageUrl: 'http://images.test/x.png' }));
    } finally { await restartedPool.end(); }
  });

  await t.test('rejected pending INSERT is safe for image compensation and leaves no report', async () => {
    const before = await counts();
    await pool.query(`CREATE FUNCTION civicmerge.test_reject_pending() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'forced pending rejection'; END; $$`);
    await pool.query(`CREATE TRIGGER test_reject_pending BEFORE INSERT ON civicmerge.reports
      FOR EACH ROW EXECUTE FUNCTION civicmerge.test_reject_pending()`);
    try {
      await assert.rejects(pending(), expectDomain('DATABASE_WRITE_REJECTED', 503));
      assert.deepEqual(await counts(), before);
    } finally {
      await pool.query('DROP TRIGGER test_reject_pending ON civicmerge.reports');
      await pool.query('DROP FUNCTION civicmerge.test_reject_pending()');
    }
  });

  await t.test('persistent HTTP bootstrap uses mocks, permits no GPS and never exposes reset controls', async () => {
    const uploadDir = await mkdtemp(path.join(tmpdir(), 'civicmerge-db-test-'));
    const { app } = createPostgresApp({ pool, uploadDir, publicBaseUrl: 'http://images.test' });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;
    try {
      const before = await counts();
      await assert.rejects(repository.reset(), expectDomain('RESET_DISABLED', 403));
      for (const [method, route] of [['POST', '/api/mock/reset'], ['POST', '/api/mock/scenario'], ['GET', '/api/mock/state']]) {
        assert.equal((await fetch(base + route, { method })).status, 404);
      }
      assert.deepEqual(await counts(), before);
      assert.deepEqual(await (await fetch(base + '/health')).json(), { status: 'ok', mode: 'mock' });
      const form = new FormData();
      form.append('image', new Blob([await readFile(new URL('../../mocks/images/pothole-1.png', import.meta.url))], { type: 'image/png' }), 'client.png');
      const response = await fetch(base + '/api/reports/analyze', { method: 'POST', body: form });
      assert.equal(response.status, 201);
      const analyzed = AnalyzeResponseSchema.parse(await response.json());
      assert.deepEqual(analyzed.candidates, []); assert.equal(analyzed.warnings[0].code, 'GPS_UNAVAILABLE');
      const post = (data: unknown) => fetch(base + '/api/reports/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      assert.equal((await post({ reportId: analyzed.reportId, action: 'merge', targetIncidentId: randomUUID() })).status, 404);
      const created = await post({ reportId: analyzed.reportId, action: 'create' }); assert.equal(created.status, 200);
      const snapshot = ConfirmResponseSchema.parse(await created.json());
      assert.equal((await post({ reportId: analyzed.reportId, action: 'merge', targetIncidentId: snapshot.incidentId })).status, 409);
      assert.deepEqual(await (await post({ reportId: analyzed.reportId, action: 'create' })).json(), snapshot);
      assert.equal((await post({ reportId: analyzed.reportId, action: 'merge' })).status, 400);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      await rm(uploadDir, { recursive: true, force: true });
    }
  });

  const resolvedTarget = async () => {
    const report = await pending();
    const request: ConfirmRequest = { reportId: report.id, action: 'create' };
    const snapshot = await repository.confirm(request, team);
    return { report, request, snapshot, id: snapshot.incidentId };
  };
  const waitForBlockedBy = async (pid: number) => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const waiting = await pool.query(`SELECT pid FROM pg_stat_activity
        WHERE datname = current_database() AND $1::int = ANY(pg_blocking_pids(pid))`, [pid]);
      if (waiting.rows.length) return Number(waiting.rows[0].pid);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('Expected PostgreSQL row/advisory lock wait was not observed.');
  };
  const settle = <T>(promise: Promise<T>) => promise.then(value => ({ value, error: undefined as unknown }), error => ({ value: undefined, error: error as unknown }));

  await t.test('resolved rejects new merge without consuming pending; old snapshots win and in_progress is preserved', async () => {
    const target = await resolvedTarget();
    const acceptedReport = await pending();
    const acceptedRequest: ConfirmRequest = { reportId: acceptedReport.id, action: 'merge', targetIncidentId: target.id };
    const accepted = await repository.confirm(acceptedRequest, team);
    await pool.query("UPDATE civicmerge.incidents SET status = 'resolved' WHERE id = $1", [target.id]);
    const report = await pending(); const before = await counts(); const beforeDetail = await repository.get(target.id);
    await assert.rejects(peer.confirm({ reportId: report.id, action: 'merge', targetIncidentId: target.id }, team), expectDomain('INCIDENT_RESOLVED', 409));
    assert.equal((await repository.findReport(report.id))!.status, 'pending');
    assert.equal((await repository.findReport(report.id))!.incidentId, null);
    assert.deepEqual(await counts(), before); assert.deepEqual(await repository.get(target.id), beforeDetail);
    assert.deepEqual(await repository.confirm(target.request, 'changed team'), target.snapshot);
    assert.deepEqual(await peer.confirm(acceptedRequest, 'changed team'), accepted);
    await assert.rejects(repository.confirm({ reportId: acceptedReport.id, action: 'create' }, team), expectDomain('REPORT_ALREADY_CONFIRMED', 409));
    const replacement = await repository.confirm({ reportId: report.id, action: 'create' }, team);
    assert.notEqual(replacement.incidentId, target.id);
    await pool.query("UPDATE civicmerge.incidents SET status = 'in_progress' WHERE id = $1", [replacement.incidentId]);
    const next = await pending();
    await peer.confirm({ reportId: next.id, action: 'merge', targetIncidentId: replacement.incidentId }, team);
    assert.equal((await repository.get(replacement.incidentId))!.status, 'in_progress');
    assert.equal((await repository.get(target.id))!.status, 'resolved');
  });

  await t.test('resolve commits first: waiting confirm rechecks status under incident lock and rolls back', async () => {
    const target = await resolvedTarget(); const report = await pending(); const before = await counts();
    const resolver = await peerPool.connect(); let open = false;
    let merge: Promise<{ value: ConfirmResponse | undefined; error: unknown }> | undefined;
    try {
      const pid = Number((await resolver.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
      await resolver.query('BEGIN'); open = true;
      await resolver.query("UPDATE civicmerge.incidents SET status = 'resolved' WHERE id = $1", [target.id]);
      merge = settle(repository.confirm({ reportId: report.id, action: 'merge', targetIncidentId: target.id }, team));
      await waitForBlockedBy(pid);
      await resolver.query('COMMIT'); open = false;
      const outcome = await merge; expectDomain('INCIDENT_RESOLVED', 409)(outcome.error);
      assert.deepEqual(await counts(), before);
      assert.equal((await repository.findReport(report.id))!.status, 'pending');
      assert.equal((await repository.get(target.id))!.status, 'resolved');
      assert.deepEqual(await repository.confirm(target.request, team), target.snapshot);
    } finally {
      if (open) await resolver.query('ROLLBACK');
      resolver.release(); await merge;
    }
  });

  await t.test('confirm commits first: later resolve waits, accepted merge snapshot survives resolution', async () => {
    const target = await resolvedTarget(); const report = await pending();
    const request: ConfirmRequest = { reportId: report.id, action: 'merge', targetIncidentId: target.id };
    const locker = await pool.connect(); const resolver = await peerPool.connect(); let held = false;
    let merge: Promise<{ value: ConfirmResponse | undefined; error: unknown }> | undefined;
    let resolution: Promise<unknown> | undefined;
    await pool.query(`CREATE FUNCTION civicmerge.test_pause_merge_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN PERFORM pg_advisory_xact_lock(728174635); RETURN NEW; END; $$`);
    await pool.query(`CREATE TRIGGER test_pause_merge_snapshot BEFORE INSERT ON civicmerge.confirmations
      FOR EACH ROW WHEN (NEW.report_id = '${report.id}'::uuid) EXECUTE FUNCTION civicmerge.test_pause_merge_snapshot()`);
    try {
      const lockerPid = Number((await locker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
      const resolverPid = Number((await resolver.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
      await locker.query('SELECT pg_advisory_lock(728174635)'); held = true;
      merge = settle(repository.confirm(request, team));
      const mergePid = await waitForBlockedBy(lockerPid);
      resolution = settle(resolver.query("UPDATE civicmerge.incidents SET status = 'resolved' WHERE id = $1", [target.id]));
      assert.equal(await waitForBlockedBy(mergePid), resolverPid);
      await locker.query('SELECT pg_advisory_unlock(728174635)'); held = false;
      const outcome = await merge; assert.equal(outcome.error, undefined); assert.equal(outcome.value!.reportCount, 2);
      const resolutionOutcome = await resolution as { error: unknown }; assert.equal(resolutionOutcome.error, undefined);
      const detail = (await repository.get(target.id))!;
      assert.equal(detail.status, 'resolved'); assert.equal(detail.reportCount, 2); assert.equal(detail.history.length, 2);
      assert.deepEqual(await peer.confirm(request, team), outcome.value);
      await assert.rejects(repository.confirm({ reportId: report.id, action: 'create' }, team), expectDomain('REPORT_ALREADY_CONFIRMED', 409));
    } finally {
      if (held) await locker.query('SELECT pg_advisory_unlock(728174635)');
      await merge; await resolution;
      await pool.query('DROP TRIGGER test_pause_merge_snapshot ON civicmerge.confirmations');
      await pool.query('DROP FUNCTION civicmerge.test_pause_merge_snapshot()');
      locker.release(); resolver.release();
    }
  });

  await t.test('configured OpenAI/GPS factories with PostgreSQL and simulated Storage network preserve two-photo workflow', async sub => {
    const uploadDir = await mkdtemp(path.join(tmpdir(), 'civicmerge-configured-database-'));
    sub.after(() => rm(uploadDir, { recursive: true, force: true }));
    const originalFetch = globalThis.fetch;
    sub.mock.method(globalThis, 'fetch', (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (String(input) !== 'https://api.openai.com/v1/responses') return originalFetch(input, init);
      return Promise.resolve(Response.json({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(analysis) }] }] }));
    });
    const env = { PUBLIC_BASE_URL: 'http://images.test', PERSISTENCE_MODE: 'postgres', STORAGE_PROVIDER: 'supabase',
      SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test_only_fixture', SUPABASE_STORAGE_BUCKET: 'isolated',
      AI_PROVIDER: 'openai', OPENAI_API_KEY: 'test-only-ai-key', OPENAI_MODEL: 'fixture-model', MATCHING_PROVIDER: 'real',
      MOCK_MODE: 'true', UPLOAD_DIR: uploadDir };
    const storage = fakeStorage();
    const factories = { ...loadVisionFactories(env), ...await loadMatchingFactories(env) };
    const backend = await createConfiguredBackend(env, { root: '.', pool, fetch: storage.fetcher, factories });
    const server = backend.app.listen(0, '127.0.0.1'); await once(server, 'listening');
    sub.after(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;
    const analyze = async (name: string) => {
      const bytes = await readFile(new URL(`../../mocks/images/${name}.png`, import.meta.url));
      const form = new FormData(); form.append('image', new Blob([bytes], { type: 'image/png' }), 'fixture.png');
      form.append('latitude', '-50'); form.append('longitude', '-120');
      const response = await originalFetch(base + '/api/reports/analyze', { method: 'POST', body: form });
      assert.equal(response.status, 201); return AnalyzeResponseSchema.parse(await response.json());
    };
    const confirm = async (body: unknown) => {
      const response = await originalFetch(base + '/api/reports/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(response.status, 200); return ConfirmResponseSchema.parse(await response.json());
    };
    const first = await analyze('pothole-1'); assert.deepEqual(first.candidates, []);
    const create = { reportId: first.reportId, action: 'create' };
    const created = await confirm(create);
    const second = await analyze('pothole-2'); assert.equal(second.candidates[0].incidentId, created.incidentId);
    const merge = { reportId: second.reportId, action: 'merge', targetIncidentId: created.incidentId };
    const merged = await Promise.all(Array.from({ length: 5 }, () => confirm(merge)));
    assert.ok(merged.every(value => value.reportCount === 2)); assert.deepEqual(await confirm(create), created);
    const detail = (await peer.get(created.incidentId))!;
    assert.equal(detail.reportCount, 2); assert.equal(detail.reports.length, 2); assert.equal(detail.history.length, 2);
    assert.equal(storage.objects.size, 2);
    const httpDetail = await (await originalFetch(`${base}/api/incidents/${created.incidentId}`)).json();
    for (const report of httpDetail.reports) assert.equal((await originalFetch(base + new URL(report.imageUrl).pathname)).status, 200);
    assert.equal((await originalFetch(base + '/api/mock/reset', { method: 'POST' })).status, 404);
  });
});
