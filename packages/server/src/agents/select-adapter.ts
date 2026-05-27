import type { AgentAdapter } from './adapter';
import { offlineAdapter } from './offline-adapter';
import { createHaikuAdapter } from './haiku-adapter';

export function getAuditAdapter(): AgentAdapter {
  if (process.env.ANTHROPIC_API_KEY) {
    return createHaikuAdapter();
  }
  return offlineAdapter;
}
