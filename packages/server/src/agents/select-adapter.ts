import fs from 'fs';
import path from 'path';
import type { AgentAdapter } from './adapter';
import { offlineAdapter } from './offline-adapter';
import { createHaikuAdapter } from './haiku-adapter';

function claudeBinPath(): string | null {
  const envBin = process.env.CODE_QUESTS_CLAUDE_BIN;
  if (envBin) return envBin;

  const dirs = (process.env.PATH ?? '').split(path.delimiter);
  for (const dir of dirs) {
    const candidate = path.join(dir, 'claude');
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // not in this directory
    }
  }
  return null;
}

function createClaudeCodeAdapter(): AgentAdapter {
  throw new Error(
    'Claude Code adapter not implemented — cartagena ships the real implementation',
  );
}

export function getAuditAdapter(): AgentAdapter {
  if (process.env.ANTHROPIC_API_KEY) {
    return createHaikuAdapter();
  }
  return offlineAdapter;
}

export function getQuestAdapter(): AgentAdapter {
  if (process.env.CODE_QUESTS_USE_REAL_AGENT === '1' && claudeBinPath()) {
    return createClaudeCodeAdapter();
  }
  return offlineAdapter;
}
