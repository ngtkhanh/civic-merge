import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMockApp } from './bootstrap/mock.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
config({ path: path.join(root, 'apps/api/.env'), quiet: true });
if (process.env.MOCK_MODE !== 'true') throw new Error('Set MOCK_MODE=true in apps/api/.env. Real adapters are not implemented yet.');
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const publicBaseUrl = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '');
if (!publicBaseUrl || !/^https?:\/\//.test(publicBaseUrl)) throw new Error('Set PUBLIC_BASE_URL to the API address reachable by the iPhone.');
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(root, '.runtime/uploads'));
const { app } = createMockApp({ uploadDir, publicBaseUrl });
const server = app.listen(port, process.env.HOST ?? '0.0.0.0', () => {
  console.log(`CivicMerge MOCK API: ${publicBaseUrl} | data resets on restart | scenario=pothole`);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.close(() => process.exit(0)));
