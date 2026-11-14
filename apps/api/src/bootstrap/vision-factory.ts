import { createOpenAIVision } from '@civicmerge/ai-vision';
import type { AdapterFactories } from './configured.js';

// Only the backend composition root receives credentials. Mock mode never
// constructs an OpenAI adapter and selecting OpenAI never falls back to mock.
export function loadVisionFactories(env: NodeJS.ProcessEnv): AdapterFactories {
  return env.AI_PROVIDER === 'openai' ? { openai: createOpenAIVision } : {};
}
