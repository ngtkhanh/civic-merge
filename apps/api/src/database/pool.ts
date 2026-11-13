import { readFileSync } from 'node:fs';
import { Pool } from 'pg';

export function createDatabasePool(env: NodeJS.ProcessEnv = process.env, key = 'DATABASE_URL'): Pool {
  const value = env[key];
  if (!value) throw new Error(`Set ${key} privately for the backend database connection.`);
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`Invalid ${key}; expected a PostgreSQL connection URL.`); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error(`Invalid ${key} protocol.`);
  // pg connection-string SSL parameters can override the explicit TLS config.
  if ([...url.searchParams.keys()].some(name => name.toLowerCase().startsWith('ssl'))) {
    throw new Error(`Remove SSL parameters from ${key}; use DATABASE_SSL and DATABASE_SSL_CA_FILE.`);
  }
  const sslMode = env.DATABASE_SSL ?? 'verify';
  if (!['verify', 'disable'].includes(sslMode)) throw new Error('DATABASE_SSL must be verify or disable.');
  const pool = new Pool({
    connectionString: value,
    ssl: sslMode === 'disable' ? false : {
      rejectUnauthorized: true,
      ...(env.DATABASE_SSL_CA_FILE ? { ca: readFileSync(env.DATABASE_SSL_CA_FILE, 'utf8') } : {}),
    },
    max: 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000,
    statement_timeout: 15000, idle_in_transaction_session_timeout: 15000,
  });
  // Driver error messages can contain connection information: never print them.
  pool.on('error', () => console.error('Database connection failed. Check private backend configuration.'));
  return pool;
}
