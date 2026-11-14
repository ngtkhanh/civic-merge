import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir, type NetworkInterfaceInfo } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { controlAddress, parseSession, prepareExistingDemo, selectLanAddress, sendCommand, startControl, type DemoSession } from '../../apps/api/src/demo/control.js';

const nic = (address: string, internal = false): NetworkInterfaceInfo => ({ address, internal, family: 'IPv4', netmask: '255.255.255.0', cidr: `${address}/24`, mac: '00:00:00:00:00:00' });
test('LAN selection avoids loopback/virtual adapters and refuses ambiguous or foreign addresses', () => {
  const interfaces = { Loopback: [nic('127.0.0.1', true)], 'Wi-Fi': [nic('192.168.1.2')], 'vEthernet (WSL)': [nic('172.20.0.1')] };
  assert.equal(selectLanAddress(undefined, 'http://192.168.1.2:3000', interfaces), '192.168.1.2');
  assert.equal(selectLanAddress(undefined, undefined, interfaces), '192.168.1.2');
  assert.throws(() => selectLanAddress('192.168.1.99', undefined, interfaces), /assigned/);
  assert.throws(() => selectLanAddress('127.0.0.1', undefined, interfaces), /assigned/);
  assert.throws(() => selectLanAddress(undefined, undefined, { ...interfaces, Ethernet: [nic('10.0.0.2')] }), /Cannot select/);
});

test('invalid session metadata cannot target port 3000 or a credential-bearing URL', () => {
  const session: DemoSession = { pid: process.pid, nonce: randomUUID(), publicBaseUrl: 'http://192.168.1.2:3011', port: 3011 };
  assert.deepEqual(parseSession(session), session);
  for (const value of [{ ...session, port: 3000 }, { ...session, pid: -1 }, { ...session, nonce: 'invalid' },
    { ...session, publicBaseUrl: 'http://user:password@192.168.1.2:3011' }, { ...session, publicBaseUrl: 'http://192.168.1.2:3000' }]) {
    assert.throws(() => parseSession(value));
  }
});

test('stop authenticates the exact managed session; stale token/PID cannot stop another process', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'civicmerge-demo-control-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const address = controlAddress(directory);
  const session: DemoSession = { pid: process.pid, nonce: randomUUID(), publicBaseUrl: 'http://192.168.1.2:3011', port: 3011 };
  let stops = 0;
  const server = await startControl(address, session, () => { stops++; });
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  await sendCommand(address, session, 'status'); assert.equal(stops, 0);
  await assert.rejects(sendCommand(address, { ...session, nonce: randomUUID() }, 'stop'), /authenticate/);
  assert.equal(stops, 0);
  await assert.rejects(sendCommand(address, { ...session, pid: process.pid + 1 }, 'stop'), /authenticate/);
  assert.equal(stops, 0);
  await sendCommand(address, session, 'stop');
  await new Promise<void>(resolve => setImmediate(resolve)); assert.equal(stops, 1);
});

test('controller refusing ownership never falls back to killing a PID', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'civicmerge-demo-foreign-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const address = controlAddress(directory);
  const server = net.createServer(socket => { socket.on('error', () => {}); socket.once('data', () => socket.end('{"ok":false}\n')); });
  server.listen(address); await once(server, 'listening');
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  await assert.rejects(sendCommand(address, { pid: process.pid, nonce: randomUUID(), publicBaseUrl: 'http://192.168.1.2:3011', port: 3011 }, 'stop'), /No process was killed/);
});

test('one-click start reuses the same LAN session and restarts only after changed-IP session finishes', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'civicmerge-demo-network-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const address = controlAddress(directory);
  const session: DemoSession = { pid: process.pid, nonce: randomUUID(), publicBaseUrl: 'http://192.168.1.2:3011', port: 3011 };
  let lock: DemoSession | null = session; let stops = 0;
  const server = await startControl(address, session, () => { stops++; setTimeout(() => { lock = null; }, 30); });
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  assert.equal(await prepareExistingDemo(address, session, session.publicBaseUrl, async () => lock), 'reuse');
  assert.equal(stops, 0);
  assert.equal(await prepareExistingDemo(address, session, 'http://10.125.81.248:3011', async () => lock), 'restart');
  assert.equal(stops, 1); assert.equal(lock, null, 'must wait for graceful shutdown before starting a replacement');
});

test('one-click restart refuses stale authentication and does not force a slow shutdown', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'civicmerge-demo-restart-refusal-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const address = controlAddress(directory);
  const session: DemoSession = { pid: process.pid, nonce: randomUUID(), publicBaseUrl: 'http://192.168.1.2:3011', port: 3011 };
  let stops = 0;
  const server = await startControl(address, session, () => { stops++; });
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  await assert.rejects(prepareExistingDemo(address, { ...session, nonce: randomUUID() }, 'http://10.125.81.248:3011', async () => session), /authenticate/);
  assert.equal(stops, 0);
  await assert.rejects(prepareExistingDemo(address, session, 'http://10.125.81.248:3011', async () => session, 10), /still finishing/);
  assert.equal(stops, 1, 'only graceful stop was requested; no PID kill fallback');
});
