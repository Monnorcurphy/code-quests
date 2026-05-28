import type { AgentEvent } from '@code-quests/shared';
import type { AgentAdapter, AgentHandle, AgentSpawnInput } from './adapter';

export const OFFLINE_PAUSE_QUESTION = 'Should I use approach A or approach B?';

function delay(): Promise<void> {
  return new Promise<void>((r) => setImmediate(r));
}

function createOfflineHandle(): AgentHandle {
  let resolveExit!: (v: { exitCode: number | null }) => void;
  const exitPromise = new Promise<{ exitCode: number | null }>((res) => {
    resolveExit = res;
  });

  let resolveRespond: ((text: string) => void) | null = null;
  const respondPromise = new Promise<string>((res) => {
    resolveRespond = res;
  });

  let settled = false;

  async function* generateEvents(): AsyncGenerator<AgentEvent> {
    const now = () => new Date().toISOString();

    await delay();
    yield { type: 'progress', timestamp: now(), message: 'Setting out from town' };

    await delay();
    yield { type: 'paused_input', timestamp: now(), question: OFFLINE_PAUSE_QUESTION };

    await respondPromise;

    if (settled) return;

    yield { type: 'resumed', timestamp: now(), source: 'input_response' };

    await delay();
    yield {
      type: 'combat',
      timestamp: now(),
      monsterTypeId: 'goblin_linter',
      message: 'Skirmish with a Goblin',
    };

    await delay();
    yield { type: 'progress', timestamp: now(), message: 'Returning home' };

    await delay();
    yield { type: 'completed', timestamp: now(), summary: 'Quest completed in offline demo.' };

    resolveExit({ exitCode: 0 });
  }

  const iter = generateEvents();

  return {
    pid: null,
    events(): AsyncIterable<AgentEvent> {
      return iter;
    },
    async cancel(): Promise<void> {
      if (!settled) {
        settled = true;
        resolveRespond?.('__cancel__');
        resolveRespond = null;
        resolveExit({ exitCode: null });
      }
    },
    async respond(text: string): Promise<void> {
      resolveRespond?.(text);
      resolveRespond = null;
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
