import type { AgentAdapter } from './adapter';
import { offlineAdapter } from './offline-adapter';
import { createHaikuAdapter } from './haiku-adapter';
import { createCcAdapter, findBinPath } from './cc-adapter';

export function getAuditAdapter(): AgentAdapter {
  if (process.env.ANTHROPIC_API_KEY) {
    return createHaikuAdapter();
  }
  return offlineAdapter;
}

export function getQuestAdapter(): AgentAdapter {
  if (process.env.CODE_QUESTS_USE_REAL_AGENT === '1' && findBinPath() !== null) {
    return createCcAdapter();
  }
  return offlineAdapter;
}
