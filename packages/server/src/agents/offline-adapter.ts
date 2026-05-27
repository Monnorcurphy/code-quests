import type { AgentEvent } from '@code-quests/shared';
import type { AgentAdapter, AgentHandle, AgentSpawnInput } from './adapter';

function makeOfflineEvents(): AgentEvent[] {
  const now = new Date().toISOString();
  return [
    { type: 'progress', timestamp: now, message: 'Setting out from town' },
    {
      type: 'combat',
      timestamp: now,
      monsterTypeId: 'goblin_linter',
      message: 'Skirmish with a Goblin',
    },
    { type: 'progress', timestamp: now, message: 'Returning home' },
    { type: 'completed', timestamp: now, summary: 'Quest completed in offline demo.' },
  ];
}

function createOfflineHandle(): AgentHandle {
  let resolveExit!: (v: { exitCode: number | null }) => void;
  const exitPromise = new Promise<{ exitCode: number | null }>((res) => {
    resolveExit = res;
  });

  async function* generateEvents(): AsyncGenerator<AgentEvent> {
    for (const event of makeOfflineEvents()) {
      await new Promise<void>((r) => setImmediate(r));
      yield { ...event, timestamp: new Date().toISOString() };
    }
    resolveExit({ exitCode: 0 });
  }

  const iter = generateEvents();

  return {
    pid: null,
    events(): AsyncIterable<AgentEvent> {
      return iter;
    },
    async cancel(): Promise<void> {
      resolveExit({ exitCode: null });
    },
    async awaitExit(): Promise<{ exitCode: number | null }> {
      return exitPromise;
    },
  };
}

export const offlineAdapter: AgentAdapter = {
  name: 'offline',
  async complete(
    _input: { system: string; prompt: string; maxTokens?: number },
  ): Promise<string> {
    return JSON.stringify({ gaps: [] });
  },
  async spawn(_input: AgentSpawnInput): Promise<AgentHandle> {
    return createOfflineHandle();
  },
};
