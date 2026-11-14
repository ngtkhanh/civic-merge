import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import type { Pool } from 'pg';

const migrationDirectory = new URL('../../../../supabase/migrations/', import.meta.url);

export async function migrateDatabase(pool: Pool): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];
  let failedConnection: Error | undefined;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(728174631)');
    await client.query('CREATE SCHEMA IF NOT EXISTS civicmerge');
    await client.query('REVOKE ALL ON SCHEMA civicmerge FROM PUBLIC');
    await client.query(`CREATE TABLE IF NOT EXISTS civicmerge.schema_migrations (
      name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
    )`);
    await client.query('ALTER TABLE civicmerge.schema_migrations ENABLE ROW LEVEL SECURITY');
    await client.query('REVOKE ALL ON civicmerge.schema_migrations FROM PUBLIC');
    for (const name of (await readdir(migrationDirectory)).filter(name => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort()) {
      const sql = await readFile(new URL(name, migrationDirectory), 'utf8');
      const sha256 = createHash('sha256').update(sql).digest('hex');
      const prior = await client.query('SELECT sha256 FROM civicmerge.schema_migrations WHERE name = $1', [name]);
      if (prior.rows[0]) {
        if (prior.rows[0].sha256 !== sha256) throw new Error('An applied migration checksum changed. Add a new migration instead.');
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO civicmerge.schema_migrations (name, sha256) VALUES ($1, $2)', [name, sha256]);
      applied.push(name);
    }
    await client.query('COMMIT');
    return applied;
  } catch (error) {
    try { await client.query('ROLLBACK'); }
    catch { failedConnection = new Error('Migration rollback failed'); }
    throw error;
  } finally { client.release(failedConnection); }
}
