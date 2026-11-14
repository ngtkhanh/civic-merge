import { config } from 'dotenv';
import { createDatabasePool } from '../src/database/pool.js';
import { migrateDatabase } from '../src/database/migrate.js';

config({ path: new URL('../.env', import.meta.url), quiet: true });
try {
  // Separate migration-owner credential is optional; never used by the HTTP server.
  const pool = createDatabasePool(process.env, process.env.MIGRATION_DATABASE_URL ? 'MIGRATION_DATABASE_URL' : 'DATABASE_URL');
  try {
    const applied = await migrateDatabase(pool);
    console.log(applied.length ? `Applied migrations: ${applied.join(', ')}` : 'Database migrations are up to date.');
  } finally { await pool.end(); }
} catch {
  console.error('Database migration failed. Check private connection/TLS settings, migration checksums and owner permissions. No credentials are logged.');
  process.exitCode = 1;
}
