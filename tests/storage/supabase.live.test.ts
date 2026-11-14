import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { parse } from 'dotenv';
import { AnalyzeResponseSchema, IncidentDetailSchema } from '@civicmerge/contracts';
import { createSupabaseStorage, parseImageReference } from '../../apps/api/src/storage/supabase.js';
import { createConfiguredBackend } from '../../apps/api/src/bootstrap/configured.js';
import { createDatabasePool } from '../../apps/api/src/database/pool.js';
import { migrateDatabase } from '../../apps/api/src/database/migrate.js';

// This opt-in command reads server credentials privately. It NEVER uses
// DATABASE_URL: application/shared database is not part of these tests.
const root = fileURLToPath(new URL('../../', import.meta.url));
let local: NodeJS.ProcessEnv = {};
try { local = parse(await readFile(new URL('../../apps/api/.env', import.meta.url))); } catch { /* Explicit skip below. */ }
const env = { ...local, ...process.env };
const ready = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_STORAGE_BUCKET', 'SUPABASE_STORAGE_TEST_BUCKET'].every(key => !!env[key]);

test('live Supabase private Storage (separate test bucket; no shared DB writes)', {
  skip: ready ? false : 'Missing private SUPABASE_URL/SECRET_KEY/STORAGE_BUCKET/STORAGE_TEST_BUCKET.', timeout: 120000,
}, async t => {
  assert.notEqual(env.SUPABASE_STORAGE_TEST_BUCKET, env.SUPABASE_STORAGE_BUCKET, 'Test bucket must differ from application bucket.');
  const prefix = `test-${randomUUID()}`;
  const options = { url: env.SUPABASE_URL!, secretKey: env.SUPABASE_SECRET_KEY!, bucket: env.SUPABASE_STORAGE_TEST_BUCKET!, prefix };
  const storage = createSupabaseStorage(options);
  const created = new Set<string>();
  t.after(async () => { for (const ref of created) await storage.remove(ref); });
  const png = await readFile(new URL('../../mocks/images/pothole-1.png', import.meta.url));
  await t.test('both configured buckets exist and are private (read-only check)', async () => {
    await storage.checkReady();
    await createSupabaseStorage({ ...options, bucket: env.SUPABASE_STORAGE_BUCKET! }).checkReady();
  });
  let reference: string;
  await t.test('real upload/download and new adapter read identical bytes without signed URLs', async () => {
    reference = await storage.save({ bytes: png, mimeType: 'image/png' }); created.add(reference);
    const object = parseImageReference(reference)!;
    const restarted = createSupabaseStorage(options);
    assert.deepEqual(Buffer.from((await restarted.readObject(object.bucket, object.prefix, object.name)).bytes), png);
    assert.equal(new URL(reference).search, '');
  });
  await t.test('real deletion is restricted to the object created by this run', async () => {
    assert.ok(reference!); const object = parseImageReference(reference!)!;
    await storage.remove(reference!); created.delete(reference!);
    await assert.rejects(storage.readObject(object.bucket, object.prefix, object.name), { code: 'IMAGE_NOT_FOUND' });
  });
  await t.test('HTTP pipeline with real Storage + isolated PostgreSQL, restart and concurrent merge', {
    skip: process.env.TEST_DATABASE_URL ? false : 'TEST_DATABASE_URL missing; real Storage tested, PostgreSQL+Storage pipeline not run.',
  }, async sub => {
    assert.equal(process.env.CIVICMERGE_DB_TEST, 'isolated');
    const testUrl = new URL(process.env.TEST_DATABASE_URL!);
    assert.match(decodeURIComponent(testUrl.pathname.slice(1)), /^civicmerge_test_[a-z0-9_]+$/);
    const pool = createDatabasePool(process.env, 'TEST_DATABASE_URL');
    const guard = await pool.connect();
    sub.after(async () => { guard.release(); await pool.end(); });
    const checked = await guard.query('SELECT current_database() AS name, pg_try_advisory_lock(728174632) AS locked');
    assert.match(checked.rows[0].name, /^civicmerge_test_[a-z0-9_]+$/); assert.equal(checked.rows[0].locked, true);
    const prior = await guard.query("SELECT count(*)::int AS count FROM pg_namespace WHERE nspname='civicmerge'");
    assert.equal(prior.rows[0].count, 0, 'Fresh isolated database required; never reset an existing schema.');
    await migrateDatabase(pool);
    const uploadDir = await mkdtemp(path.join(tmpdir(), 'civicmerge-live-storage-'));
    sub.after(() => rm(uploadDir, { recursive: true, force: true }));
    const remoteFetch: typeof fetch = async (input, init) => {
      const response = await fetch(input, init);
      if (init?.method === 'POST' && response.ok) {
        const key = new URL(String(input)).pathname.split('/object/')[1];
        if (key) created.add(`https://civicmerge-storage.invalid/${key}`);
      }
      return response;
    };
    const configuration = { ...env, PERSISTENCE_MODE: 'postgres', STORAGE_PROVIDER: 'supabase', AI_PROVIDER: 'mock', MATCHING_PROVIDER: 'mock',
      MOCK_MODE: 'true', PUBLIC_BASE_URL: 'http://previous-backend.test:3011', UPLOAD_DIR: uploadDir,
      SUPABASE_STORAGE_BUCKET: options.bucket, SUPABASE_STORAGE_PREFIX: prefix };
    const start = async (publicBaseUrl: string) => {
      const backend = await createConfiguredBackend({ ...configuration, PUBLIC_BASE_URL: publicBaseUrl }, { root, pool, fetch: remoteFetch });
      const server = backend.app.listen(0, '127.0.0.1'); await once(server, 'listening');
      const address = server.address(); assert.ok(address && typeof address !== 'string');
      const close = () => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); });
      sub.after(close);
      const base = `http://127.0.0.1:${address.port}`;
      const post = (body: unknown) => fetch(base + '/api/reports/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const analyze = async () => {
        const form = new FormData(); form.append('image', new Blob([png], { type: 'image/png' }), 'live-test.png');
        form.append('latitude', '10.7769'); form.append('longitude', '106.7009');
        const response = await fetch(base + '/api/reports/analyze', { method: 'POST', body: form });
        assert.equal(response.status, 201); return AnalyzeResponseSchema.parse(await response.json());
      };
      return { base, post, analyze, close, backend };
    };
    const firstServer = await start('http://previous-backend.test:3011');
    const first = await firstServer.analyze();
    const create = { reportId: first.reportId, action: 'create' };
    const initial = await Promise.all(Array.from({ length: 8 }, () => firstServer.post(create).then(r => r.json())));
    assert.ok(initial.every(r => r.incidentId === initial[0].incidentId && r.reportCount === 1));
    const second = await firstServer.analyze();
    assert.equal(second.candidates[0].incidentId, initial[0].incidentId);
    const merge = { reportId: second.reportId, action: 'merge', targetIncidentId: initial[0].incidentId };
    const merged = await Promise.all(Array.from({ length: 8 }, () => firstServer.post(merge).then(r => r.json())));
    assert.ok(merged.every(r => r.reportCount === 2));
    await firstServer.close();
    const restarted = await start('http://new-backend.test:3012');
    const detail = IncidentDetailSchema.parse(await (await fetch(`${restarted.base}/api/incidents/${initial[0].incidentId}`)).json());
    assert.equal(detail.reportCount, 2); assert.equal(detail.reports.length, 2); assert.equal(detail.history.length, 2);
    for (const report of detail.reports) {
      assert.match(report.imageUrl, /^http:\/\/new-backend.test:3012\/api\/images\//);
      const response = await fetch(restarted.base + new URL(report.imageUrl).pathname);
      assert.equal(response.status, 200); assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
    }
    assert.deepEqual(await (await restarted.post(create)).json(), initial[0]);
    assert.equal((await restarted.post({ reportId: first.reportId, action: 'merge', targetIncidentId: initial[0].incidentId })).status, 409);
    assert.equal((await fetch(restarted.base + '/api/mock/reset', { method: 'POST' })).status, 404);
    await pool.query(`CREATE FUNCTION civicmerge.test_reject_storage_pending() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'forced test INSERT rejection' USING ERRCODE = '23514'; END; $$`);
    await pool.query(`CREATE TRIGGER test_reject_storage_pending BEFORE INSERT ON civicmerge.reports
      FOR EACH ROW EXECUTE FUNCTION civicmerge.test_reject_storage_pending()`);
    try {
      const form = new FormData(); form.append('image', new Blob([png], { type: 'image/png' }), 'rejected-test.png');
      const response = await fetch(restarted.base + '/api/reports/analyze', { method: 'POST', body: form });
      assert.equal(response.status, 503); assert.equal((await response.json()).error.code, 'DATABASE_WRITE_REJECTED');
      const count = await pool.query('SELECT count(*)::int AS count FROM civicmerge.reports');
      assert.equal(count.rows[0].count, 2);
      const rejectedRef = [...created].at(-1)!;
      const object = parseImageReference(rejectedRef)!;
      await assert.rejects(storage.readObject(object.bucket, object.prefix, object.name), { code: 'IMAGE_NOT_FOUND' });
    } finally {
      await pool.query('DROP TRIGGER test_reject_storage_pending ON civicmerge.reports');
      await pool.query('DROP FUNCTION civicmerge.test_reject_storage_pending()');
    }
  });
});
