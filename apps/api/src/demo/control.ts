import { createHash } from 'node:crypto';
import net from 'node:net';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export interface DemoSession { pid: number; nonce: string; publicBaseUrl: string; port: 3011 }
export class DemoControlError extends Error {}
export function parseSession(value: unknown): DemoSession {
  const s = value as Partial<DemoSession> | null;
  if (!s || !Number.isInteger(s.pid) || s.pid! < 1 || s.port !== 3011 || typeof s.nonce !== 'string'
    || !/^[a-f0-9-]{36}$/.test(s.nonce) || typeof s.publicBaseUrl !== 'string') throw new DemoControlError('Invalid demo session metadata; no process was stopped.');
  const url = new URL(s.publicBaseUrl);
  if (url.protocol !== 'http:' || url.port !== '3011' || net.isIPv4(url.hostname) === false || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new DemoControlError('Invalid demo session URL; no process was stopped.');
  }
  return s as DemoSession;
}
export function controlAddress(root: string) {
  const id = createHash('sha256').update(path.resolve(root).toLowerCase()).digest('hex').slice(0, 16);
  return process.platform === 'win32' ? `\\\\.\\pipe\\civicmerge-demo-${id}` : path.join(root, '.runtime/demo/control.sock');
}
export function selectLanAddress(explicit: string | undefined, previousUrl: string | undefined, interfaces = networkInterfaces()): string {
  const addresses = Object.entries(interfaces).flatMap(([name, entries]) => (entries ?? [])
    .filter(entry => entry.family === 'IPv4' && !entry.internal && !entry.address.startsWith('169.254.'))
    .map(entry => ({ address: entry.address, virtual: /virtual|vethernet|vmware|vpn|wsl|loopback|bluetooth/i.test(name) })));
  if (explicit) {
    if (!net.isIPv4(explicit) || !addresses.some(entry => entry.address === explicit)) throw new DemoControlError('--ip must be an IPv4 assigned to this laptop LAN.');
    return explicit;
  }
  let previous: string | undefined;
  try { previous = new URL(previousUrl ?? '').hostname; } catch { /* No valid previous URL. */ }
  const physical = [...new Set(addresses.filter(entry => !entry.virtual).map(entry => entry.address))];
  if (previous && physical.includes(previous)) return previous;
  if (physical.length === 1) return physical[0];
  throw new DemoControlError('Cannot select one LAN address. Run demo:start -- --ip=<Wi-Fi-IPv4>.');
}

// Local IPC only, never a TCP/HTTP route or process.kill. A random session token
// prevents a stale PID file from stopping an unrelated/reused process.
export async function startControl(address: string, session: DemoSession, stop: () => void) {
  const server = net.createServer(socket => {
    socket.setEncoding('utf8'); socket.setTimeout(2000, () => socket.destroy());
    let input = ''; let handled = false;
    socket.on('error', () => {});
    socket.on('data', chunk => {
      if (handled) return;
      input += chunk;
      if (input.length > 512) { socket.destroy(); return; }
      if (!input.includes('\n')) return;
      handled = true;
      try {
        const command = JSON.parse(input.slice(0, input.indexOf('\n')));
        if (command.nonce !== session.nonce || command.pid !== session.pid || !['status', 'stop'].includes(command.action)) { socket.end('{"ok":false}\n'); return; }
        socket.end(JSON.stringify({ ok: true, session: session.nonce, pid: session.pid, publicBaseUrl: session.publicBaseUrl }) + '\n');
        if (command.action === 'stop') setImmediate(stop);
      } catch { socket.end('{"ok":false}\n'); }
    });
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(address, resolve); });
  server.on('error', () => {});
  return server;
}
export async function sendCommand(address: string, session: DemoSession, action: 'status' | 'stop') {
  return new Promise<void>((resolve, reject) => {
    const socket = net.createConnection(address); let output = '';
    const fail = () => { socket.destroy(); reject(new DemoControlError('Cannot authenticate the demo controller. No process was killed.')); };
    socket.setEncoding('utf8'); socket.setTimeout(3000, fail);
    socket.on('error', fail);
    socket.on('connect', () => socket.write(JSON.stringify({ action, nonce: session.nonce, pid: session.pid }) + '\n'));
    socket.on('data', chunk => { output += chunk; if (output.length > 1024) fail(); });
    socket.on('end', () => {
      try {
        const result = JSON.parse(output);
        if (result.ok !== true || result.session !== session.nonce || result.pid !== session.pid) { fail(); return; }
        socket.destroy(); resolve();
      } catch { fail(); }
    });
  });
}

export async function prepareExistingDemo(address: string, session: DemoSession, nextUrl: string,
  readLock: () => Promise<DemoSession | null>, timeoutMs = 30000): Promise<'reuse' | 'restart'> {
  await sendCommand(address, session, 'status');
  if (session.publicBaseUrl === nextUrl) return 'reuse';
  await sendCommand(address, session, 'stop');
  const deadline = Date.now() + timeoutMs;
  while ((await readLock())?.nonce === session.nonce) {
    if (Date.now() >= deadline) throw new DemoControlError('Demo is still finishing requests. Try opening CivicMerge.cmd again shortly; no process was killed.');
    await delay(100);
  }
  return 'restart';
}
