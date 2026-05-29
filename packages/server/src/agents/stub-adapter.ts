import type { AgentEvent } from '@code-quests/shared';
import type { AgentAdapter, AgentHandle, AgentSpawnInput } from './adapter';

function delay(): Promise<void> {
  return new Promise<void>((r) => setImmediate(r));
}

// --- Simple handle: wraps a generator, resolves exit when done ---

function createSimpleHandle(events: AsyncGenerator<AgentEvent>, exitCode = 0): AgentHandle {
  let resolveExit!: (v: { exitCode: number | null }) => void;
  const exitPromise = new Promise<{ exitCode: number | null }>((res) => {
    resolveExit = res;
  });

  async function* wrapWithExit(): AsyncGenerator<AgentEvent> {
    yield* events;
    resolveExit({ exitCode });
  }

  const iter = wrapWithExit();

  return {
    pid: null,
    events(): AsyncIterable<AgentEvent> {
      return iter;
    },
    async cancel(): Promise<void> {
      resolveExit({ exitCode: null });
    },
    async respond(_text: string): Promise<void> {
      // no-op for non-pausing quests
    },
    async awaitExit(): Promise<{ exitCode: number | null }> {
      return exitPromise;
    },
  };
}

// --- Quest-specific event sequences ---

async function* copyQuestEvents(): AsyncGenerator<AgentEvent> {
  const now = () => new Date().toISOString();
  await delay();
  yield { type: 'progress', timestamp: now(), message: "Setting out to update the login form copy…" };
  await delay();
  yield {
    type: 'monster_appeared',
    timestamp: now(),
    encounterId: 'enc-grognak-tess-copy',
    monsterId: 'grognak-the-lint-goblin',
    monsterName: 'Grognak the Lint Goblin',
    monsterTypeId: 'goblin_linter',
    spritePath: '/sprites/monsters/goblin.png',
    difficulty: 2,
  };
  await delay();
  yield {
    type: 'monster_resolved',
    timestamp: now(),
    encounterId: 'enc-grognak-tess-copy',
    outcome: 'victory',
  };
  await delay();
  yield {
    type: 'progress',
    timestamp: now(),
    message: "Linter's Bane struck true — Grognak felled. Returning to town.",
  };
  await delay();
  yield {
    type: 'completed',
    timestamp: now(),
    summary: 'Login form copy updated. All labels match the brand guide. aria-labels updated in lockstep.',
  };
}

async function* meterQuestEvents(): AsyncGenerator<AgentEvent> {
  const now = () => new Date().toISOString();
  await delay();
  yield { type: 'progress', timestamp: now(), message: 'Scouting the registration form…' };
  await delay();
  yield {
    type: 'monster_appeared',
    timestamp: now(),
    encounterId: 'enc-imp-rook-meter',
    monsterId: 'imp-typecheck-rook-1',
    monsterName: 'Imp of Type Errors',
    monsterTypeId: 'imp_typecheck',
    spritePath: '/sprites/monsters/imp.png',
    difficulty: 2,
  };
  await delay();
  yield {
    type: 'monster_resolved',
    timestamp: now(),
    encounterId: 'enc-imp-rook-meter',
    outcome: 'victory',
  };
  await delay();
  yield {
    type: 'progress',
    timestamp: now(),
    message: 'Wraith Banisher cleared the path. Implementing strength meter…',
  };
  await delay();
  yield {
    type: 'completed',
    timestamp: now(),
    summary:
      'Password strength meter implemented. Four levels with text labels and icons per WCAG.',
  };
}

async function* jwtV2QuestEvents(): AsyncGenerator<AgentEvent> {
  const now = () => new Date().toISOString();
  await delay();
  yield {
    type: 'progress',
    timestamp: now(),
    message: 'Returning with type_whisperer equipped. Type errors silenced before they can escalate.',
  };
  await delay();
  yield {
    type: 'progress',
    timestamp: now(),
    message: 'JWT endpoints secured. Refresh token rotation in place.',
  };
  await delay();
  yield {
    type: 'completed',
    timestamp: now(),
    summary:
      'JWT migration complete. All API endpoints validated. Refresh token rotation implemented and tested.',
  };
}

async function* defaultEvents(): AsyncGenerator<AgentEvent> {
  const now = () => new Date().toISOString();
  await delay();
  yield { type: 'progress', timestamp: now(), message: 'Demo quest in progress…' };
  await delay();
  yield { type: 'completed', timestamp: now(), summary: 'Quest completed in demo mode.' };
}

// --- JWT quest (Brielle): PAUSED_INPUT → escalating Imps → Lich → failed ---

function createJwtQuestHandle(): AgentHandle {
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
    yield {
      type: 'progress',
      timestamp: now(),
      message: 'Reading ADR-12 for JWT library guidance…',
    };

    await delay();
    yield {
      type: 'paused_input',
      timestamp: now(),
      question:
        'Which JWT library should I use — jose or jsonwebtoken? The ADR mentions both but does not specify.',
      context: 'ADR-12 references both libraries but does not commit to one.',
      adventureFraming:
        'The Sorcerer pauses at a fork in the dungeon — two glowing tomes before them. Choose.',
    };

    await respondPromise;
    if (settled) return;

    await delay();
    yield { type: 'resumed', timestamp: now(), source: 'input_response' };

    await delay();
    yield { type: 'progress', timestamp: now(), message: 'Proceeding with jose as instructed…' };

    await delay();
    yield {
      type: 'monster_appeared',
      timestamp: now(),
      encounterId: 'enc-imp-brielle-1',
      monsterId: 'imp-typecheck-brielle-1',
      monsterName: 'Imp of Type Errors',
      monsterTypeId: 'imp_typecheck',
      spritePath: '/sprites/monsters/imp.png',
      difficulty: 2,
    };
    await delay();
    yield {
      type: 'monster_resolved',
      timestamp: now(),
      encounterId: 'enc-imp-brielle-1',
      outcome: 'escape',
    };

    await delay();
    yield {
      type: 'monster_appeared',
      timestamp: now(),
      encounterId: 'enc-imp-brielle-2',
      monsterId: 'imp-typecheck-brielle-2',
      monsterName: 'Imp of Type Errors',
      monsterTypeId: 'imp_typecheck',
      spritePath: '/sprites/monsters/imp.png',
      difficulty: 2,
    };
    await delay();
    yield {
      type: 'monster_resolved',
      timestamp: now(),
      encounterId: 'enc-imp-brielle-2',
      outcome: 'escape',
    };

    await delay();
    yield {
      type: 'monster_appeared',
      timestamp: now(),
      encounterId: 'enc-lich-brielle',
      monsterId: 'lich-showcase',
      monsterName: 'Lich of Repeated Failures',
      monsterTypeId: 'lich_repeated_failure',
      spritePath: '/sprites/monsters/lich.png',
      difficulty: 5,
    };
    await delay();
    yield {
      type: 'monster_resolved',
      timestamp: now(),
      encounterId: 'enc-lich-brielle',
      outcome: 'defeat',
    };

    await delay();
    yield {
      type: 'failed',
      timestamp: now(),
      reason:
        'Lich of Repeated Failures rose after 3 type errors. Quest abandoned.',
    };

    resolveExit({ exitCode: 1 });
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

// --- Adapter factory ---

export function createStubAdapter(): AgentAdapter {
  return {
    name: 'stub',
    async complete(
      _input: { system: string; prompt: string; maxTokens?: number },
    ): Promise<string> {
      return JSON.stringify({ gaps: [] });
    },
    async spawn(input: AgentSpawnInput): Promise<AgentHandle> {
      const { questId } = input;

      if (questId === 'quest-showcase-copy') {
        return createSimpleHandle(copyQuestEvents());
      }
      if (questId === 'quest-showcase-meter') {
        return createSimpleHandle(meterQuestEvents());
      }
      if (questId === 'quest-showcase-jwt') {
        return createJwtQuestHandle();
      }
      // JWT repost and any other showcase quest variations
      if (questId.startsWith('quest-showcase-jwt')) {
        return createSimpleHandle(jwtV2QuestEvents());
      }

      return createSimpleHandle(defaultEvents());
    },
  };
}
