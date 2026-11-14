import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { once } from 'node:events';
import { config } from 'dotenv';
import { BackendConfigurationError, createConfiguredBackend } from '../src/bootstrap/configured.js';
import { DomainError } from '@civicmerge/contracts';
import { DemoControlError, controlAddress, parseSession, prepareExistingDemo, selectLanAddress, sendCommand, startControl, type DemoSession } from '../src/demo/control.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const directory = path.join(root, '.runtime/demo');
const stateFile = path.join(directory, 'session.json');
const lockFile = path.join(directory, 'start.lock');
const address = controlAddress(root);
config({ path: path.join(root, 'apps/api/.env'), quiet: true });
async function readSession(name = stateFile) {
  try { return parseSession(JSON.parse(await readFile(name, 'utf8'))); }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null;
    throw new DemoControlError('Demo session metadata cannot be read. No process was stopped.');
  }
}
async function removeOwnFile(name: string, session: DemoSession) {
  if ((await readSession(name))?.nonce === session.nonce) await unlink(name);
}
function alive(pid: number) {
  try { process.kill(pid, 0); return true; } // Existence probe only, never a stop signal.
  catch (error) { return !(error && typeof error === 'object' && 'code' in error && error.code === 'ESRCH'); }
}
async function main() {
  if (Number(process.versions.node.split('.')[0]) !== 24) throw new DemoControlError('Use the repository Node 24 toolchain (tested 24.21.0).');
  const action = process.argv[2] ?? 'start';
  if (!['start', 'stop', 'status', 'check'].includes(action)) throw new DemoControlError('Use demo:start, demo:status, demo:stop or demo:check.');
  if (action === 'stop' || action === 'status') {
    const session = await readSession();
    if (!session) { console.log('No managed demo backend is running. Port 3000 was not touched.'); return; }
    await sendCommand(address, session, action);
    console.log(action === 'stop' ? 'Graceful stop requested for the authenticated demo session only.' : `Demo is running: ${session.publicBaseUrl}`);
    return;
  }
  const ipOption = process.argv.slice(3).find(value => value.startsWith('--ip='))?.slice(5);
  const ip = selectLanAddress(ipOption ?? process.env.CIVICMERGE_DEMO_IP, process.env.PUBLIC_BASE_URL);
  const env = { ...process.env, PORT: '3011', HOST: '0.0.0.0', PUBLIC_BASE_URL: `http://${ip}:3011`,
    PERSISTENCE_MODE: 'postgres', STORAGE_PROVIDER: 'supabase', AI_PROVIDER: 'mock', MATCHING_PROVIDER: 'mock', MOCK_MODE: 'true' };
  if (action === 'check') {
    const backend = await createConfiguredBackend(env, { root });
    try { console.log(JSON.stringify({ status: 'ok', mode: 'mock', url: env.PUBLIC_BASE_URL, capabilities: backend.capabilities }));
      console.log('Read-only checks passed. No listener or application data writes.');
    } finally { await backend.pool?.end(); }
    return;
  }
  await mkdir(directory, { recursive: true });
  const old = await readSession(lockFile);
  if (old) {
    if (alive(old.pid)) {
      const next = await prepareExistingDemo(address, old, env.PUBLIC_BASE_URL, () => readSession(lockFile));
      if (next === 'reuse') { console.log(`CivicMerge demo: ${old.publicBaseUrl} (already running)`); return; }
      console.log(`LAN address changed. Starting demo at ${env.PUBLIC_BASE_URL}. Port 3000 was not touched.`);
    }
    await removeOwnFile(stateFile, old); await removeOwnFile(lockFile, old);
  }
  const session: DemoSession = { pid: process.pid, nonce: randomUUID(), publicBaseUrl: env.PUBLIC_BASE_URL, port: 3011 };
  await writeFile(lockFile, JSON.stringify(session), { flag: 'wx', mode: 0o600 });
  let backend: Awaited<ReturnType<typeof createConfiguredBackend>> | undefined;
  let http: ReturnType<Awaited<ReturnType<typeof createConfiguredBackend>>['app']['listen']> | undefined;
  let control: Awaited<ReturnType<typeof startControl>> | undefined;
  let stopping = false;
  const cleanup = async () => {
    if (stopping) return; stopping = true;
    if (http?.listening) await new Promise<void>(resolve => http!.close(() => resolve()));
    await backend?.pool?.end();
    if (control?.listening) await new Promise<void>(resolve => control!.close(() => resolve()));
    await removeOwnFile(stateFile, session); await removeOwnFile(lockFile, session);
  };
  const stop = () => { void cleanup().then(() => console.log('Demo stopped. Port 3000 was not touched.')).catch(() => {
    console.error('Demo shutdown needs operator review; no other process was stopped.'); process.exitCode = 1;
  }); };
  try {
    backend = await createConfiguredBackend(env, { root });
    http = backend.app.listen(3011, '0.0.0.0');
    await once(http, 'listening');
    control = await startControl(address, session, stop);
    await writeFile(stateFile, JSON.stringify(session), { flag: 'wx', mode: 0o600 });
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    console.log(`CivicMerge demo: ${env.PUBLIC_BASE_URL}`);
    console.log('PostgreSQL + private Supabase Storage; AI/matching MOCK (pothole fixture). Reset/scenario APIs disabled.');
    console.log('Keep this terminal open. Stop from another terminal: npm run demo:stop (or Ctrl+C here).');
  } catch {
    await cleanup();
    throw new DemoControlError('Demo startup failed. Check port 3011, private database/Storage configuration and demo session state. No port 3000 process was stopped.');
  }
}
try { await main(); }
catch (error) {
  // Configuration errors are constructed locally; upstream credentials/bodies
  // never reach these messages. Generic unknown failures stay redacted.
  console.error(error instanceof BackendConfigurationError || error instanceof DomainError || error instanceof DemoControlError ? error.message
    : 'Demo command failed. Check local configuration/session state.');
  process.exitCode = 1;
}
