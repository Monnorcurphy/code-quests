import type { AgentAdapter } from './adapter';
import type { Model, ModelProvider } from '@code-quests/shared';
import { offlineAdapter } from './offline-adapter';
import { createHaikuAdapter } from './haiku-adapter';
import { createCcAdapter, findBinPath } from './cc-adapter';
import { createStubAdapter } from './stub-adapter';
import { createOpenRouterAdapter } from './openrouter-adapter';
import { createOllamaAdapter } from './ollama-adapter';

export function getAuditAdapter(): AgentAdapter {
  if (process.env.ANTHROPIC_API_KEY) {
    return createHaikuAdapter();
  }
  return offlineAdapter;
}

// Picked at dispatch time when a quest has no model linked, or when
// real-agent mode is off (tests, demo, offline). Same fallback chain
// as before.
export function getDefaultQuestAdapter(): AgentAdapter {
  if (process.env['CODE_QUESTS_ENV'] === 'demo') {
    return createStubAdapter();
  }
  if (process.env.CODE_QUESTS_USE_REAL_AGENT === '1' && findBinPath() !== null) {
    return createCcAdapter();
  }
  return offlineAdapter;
}

// New: select an adapter from a Model record. Adapter cache so we don't
// rebuild on every dispatch.
const adapterCache = new Map<ModelProvider, AgentAdapter>();

export function getAdapterForModel(model: Model): AgentAdapter {
  const cached = adapterCache.get(model.provider);
  if (cached) return cached;

  let adapter: AgentAdapter;
  switch (model.provider) {
    case 'claude_cli':
      adapter = createCcAdapter();
      break;
    case 'openrouter':
      adapter = createOpenRouterAdapter();
      break;
    case 'ollama':
      adapter = createOllamaAdapter();
      break;
    case 'anthropic_api':
    case 'openai':
      // Not built yet — fall back to offline so the dispatch path doesn't
      // crash if a user managed to create one of these (the create route
      // doesn't list them anyway).
      adapter = offlineAdapter;
      break;
    default: {
      const _exhaustive: never = model.provider;
      void _exhaustive;
      adapter = offlineAdapter;
    }
  }
  adapterCache.set(model.provider, adapter);
  return adapter;
}

// Back-compat re-export. The quest-runner used to call this directly.
export const getQuestAdapter = getDefaultQuestAdapter;
