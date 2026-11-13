import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { MockStateSchema } from '@civicmerge/contracts';
config({ path: fileURLToPath(new URL('../apps/api/.env', import.meta.url)), quiet: true });
const base = (process.env.MOCK_API_URL || `http://127.0.0.1:${process.env.PORT || 3000}`).replace(/\/$/, '');
const response = await fetch(`${base}/api/mock/reset`, { method: 'POST', signal: AbortSignal.timeout(10000) });
if (!response.ok) throw new Error(`Reset failed: HTTP ${response.status}. Check backend is running in mock mode.`);
console.log('Mock business data reset:', MockStateSchema.parse(await response.json()));
