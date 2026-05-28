import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEncounterStore } from '../stores/encounter-store';
import type { AgentEvent } from '@code-quests/shared';

const { mockListQuestEncounters } = vi.hoisted(() => ({
  mockListQuestEncounters: vi.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
}));

vi.mock('../lib/api', () => ({
  api: {
    monsters: {
      listQuestEncounters: mockListQuestEncounters,
    },
  },
}));

import { rehydrateEncounterOnReconnect } from '../features/quest/use-quest-stream';

function makeServerEncounter(overrides: Record<string, unknown> = {}) {
  return {
    id: 'enc-1',
    monsterId: 'mon-1',
    questId: 'q1',
    appearedAt: '2024-01-01T00:00:00.000Z',
    combatLog: [],
    outcome: 'escape',
    loot: [],
    resolvedAt: null,
    monsterTypeId: 'goblin_linter',
    monsterName: 'Goblin',
    spritePath: 'monsters/goblin.png',
    difficulty: 1,
    ...overrides,
  };
}

function makeAppearedEvent(overrides: Partial<Extract<AgentEvent, { type: 'monster_appeared' }>> = {}): AgentEvent {
  return {
    type: 'monster_appeared',
    timestamp: '2024-01-01T00:00:00.000Z',
    encounterId: 'enc-1',
    monsterId: 'mon-1',
    monsterName: 'Goblin',
    monsterTypeId: 'goblin_linter',
    spritePath: 'monsters/goblin.png',
    difficulty: 1,
    ...overrides,
  };
}

beforeEach(() => {
  useEncounterStore.setState({ byQuest: {} });
  vi.clearAllMocks();
  mockListQuestEncounters.mockResolvedValue([]);
});

describe('rehydrateEncounterOnReconnect', () => {
  it('does nothing when server returns no encounters', async () => {
    mockListQuestEncounters.mockResolvedValue([]);
    await rehydrateEncounterOnReconnect('q1');
    expect(useEncounterStore.getState().byQuest['q1']).toBeUndefined();
  });

  it('spawns the encounter when server has an active one and client has none', async () => {
    mockListQuestEncounters.mockResolvedValue([makeServerEncounter({ resolvedAt: null })]);

    await rehydrateEncounterOnReconnect('q1');

    const encounter = useEncounterStore.getState().byQuest['q1'];
    expect(encounter).not.toBeNull();
    expect(encounter?.encounterId).toBe('enc-1');
    expect(encounter?.outcome).toBe('pending');
    expect(encounter?.monsterName).toBe('Goblin');
  });

  it('does NOT dispatch monster_resolved for an unresolved encounter with default escape outcome', async () => {
    // Client has a pending encounter
    useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());

    // Server returns the same encounter with default 'escape' but resolvedAt null (still in-flight)
    mockListQuestEncounters.mockResolvedValue([
      makeServerEncounter({ resolvedAt: null, outcome: 'escape' }),
    ]);

    await rehydrateEncounterOnReconnect('q1');

    // Store should still show the encounter as pending — not cleared by a false escape
    const encounter = useEncounterStore.getState().byQuest['q1'];
    expect(encounter?.outcome).toBe('pending');
  });

  it('dispatches monster_resolved with real outcome when server has resolved and client has pending', async () => {
    // Client has a pending encounter
    useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());

    // Server returns the same encounter now resolved as victory
    mockListQuestEncounters.mockResolvedValue([
      makeServerEncounter({ resolvedAt: '2024-01-01T00:01:00.000Z', outcome: 'victory' }),
    ]);

    await rehydrateEncounterOnReconnect('q1');

    const encounter = useEncounterStore.getState().byQuest['q1'];
    expect(encounter?.outcome).toBe('victory');
  });

  it('does nothing when both client and server have no active encounter', async () => {
    mockListQuestEncounters.mockResolvedValue([]);
    await rehydrateEncounterOnReconnect('q1');
    expect(useEncounterStore.getState().byQuest['q1']).toBeUndefined();
  });

  it('does not spawn when server has a resolved encounter and client has no pending encounter', async () => {
    // Server returns an already-resolved encounter, client has nothing pending
    mockListQuestEncounters.mockResolvedValue([
      makeServerEncounter({ resolvedAt: '2024-01-01T00:01:00.000Z', outcome: 'defeat' }),
    ]);

    await rehydrateEncounterOnReconnect('q1');

    // Nothing dispatched — the encounter already resolved, no need to re-show it
    expect(useEncounterStore.getState().byQuest['q1']).toBeUndefined();
  });

  it('does not re-spawn an already-known active encounter', async () => {
    // Client already has enc-1 as pending
    useEncounterStore.getState().handleAgentEvent('q1', makeAppearedEvent());

    // Server returns enc-1 as still active
    mockListQuestEncounters.mockResolvedValue([makeServerEncounter({ resolvedAt: null })]);

    await rehydrateEncounterOnReconnect('q1');

    // Store should still have the same pending encounter — not re-dispatched
    const encounter = useEncounterStore.getState().byQuest['q1'];
    expect(encounter?.encounterId).toBe('enc-1');
    expect(encounter?.outcome).toBe('pending');
    expect(encounter?.hp).toBe(100);
  });

  it('silently ignores API errors', async () => {
    mockListQuestEncounters.mockRejectedValue(new Error('Network error'));
    await expect(rehydrateEncounterOnReconnect('q1')).resolves.toBeUndefined();
  });
});
