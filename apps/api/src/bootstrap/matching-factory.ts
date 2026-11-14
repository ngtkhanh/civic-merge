import type { DuplicateMatcher } from '@civicmerge/contracts';
import { BackendConfigurationError } from '../configuration-error.js';
import type { AdapterFactories } from './configured.js';

// The package is a fixed workspace dependency, never a module path from .env.
// Runtime export validation keeps mock mode buildable before the owner hands off
// their additional export; it does not implement or substitute an algorithm.
export async function loadMatchingFactories(env: NodeJS.ProcessEnv, load: () => Promise<object>
  = () => import('@civicmerge/matching')): Promise<AdapterFactories> {
  if (env.MATCHING_PROVIDER !== 'real') return {};
  const module = await load();
  const factory = 'createGpsFeatureMatcher' in module ? module.createGpsFeatureMatcher : undefined;
  if (typeof factory !== 'function') {
    throw new BackendConfigurationError('MATCHING_PROVIDER=real requires the Member 4 createGpsFeatureMatcher export. Obtain the handed-off source first; no mock fallback was started.');
  }
  return { realMatcher: () => {
    const matcher: unknown = factory({ radiusMeters: 100, maxCandidates: 3 });
    if (!matcher || typeof matcher !== 'object' || !('findCandidates' in matcher) || typeof matcher.findCandidates !== 'function') {
      throw new BackendConfigurationError('createGpsFeatureMatcher must return DuplicateMatcher synchronously.');
    }
    return matcher as DuplicateMatcher;
  } };
}
