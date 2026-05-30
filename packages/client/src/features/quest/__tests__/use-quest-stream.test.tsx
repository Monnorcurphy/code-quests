import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuestStream } from '../use-quest-stream';
import { useQuestStore } from '../../../stores/quest-store';
import { sceneRouter } from '../../../game/scene-router';
import type { AgentEvent } from '@code-quests/shared';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../game/scene-router', () => ({
  sceneRouter: {
    goToScene: vi.fn(),
  },
}));

const mockHandleAgentEvent = vi.fn();
vi.mock('../../../stores/encounter-store', () => ({
  useEncounterStore: {
    getState: () => ({ handleAgentEvent: mockHandleAgentEvent }),
  },
}));

// Stable mock queryClient — same reference across renders to avoid effect re-runs
const mockInvalidateQueries = vi.fn();
const mockQueryClient = { invalidateQueries: mockInvalidateQueries };

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: vi.fn(() => mockQueryClient),
  };
});

const { mockQuestGet, mockListQuestEncounters } = vi.hoisted(() => ({
  mockQuestGet: vi.fn<() => Promise<unknown>>(),
  mockListQuestEncounters: vi.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
}));

vi.mock('../../../lib/api', () => ({
  api: {
    monsters: {
      listQuestEncounters: mockListQuestEncounters,
    },
    quests: {
      get: mockQuestGet,
    },
  },
}));

// Capture onEvent / onConnectionChange callbacks for each call
type ConnectArgs = {
  onEvent: (event: AgentEvent) => void;
  onConnectionChange?: (status: string) => void;
  onParseError?: (msg: string) => void;
};

const mockConnects: ConnectArgs[] = [];
const mockCloses: (() => void)[] = [];

vi.mock('../../../lib/quest-socket', () => ({
  connectQuestSocket: vi.fn((_questId: string, opts: ConnectArgs) => {
    mockConnects.push(opts);
    const close = vi.fn();
    mockCloses.push(close);
    return { close };
  }),
}));

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockConnects.length = 0;
  mockCloses.length = 0;
  vi.clearAllMocks();
  useQuestStore.setState({
    _nextId: 0,
    entriesByQuest: {},
    currentSceneByQuest: {},
    statusByQuest: {},
    inputRequestByQuest: {},
    userBlockerByQuest: {},
  });
  mockHandleAgentEvent.mockClear();
  mockQuestGet.mockResolvedValue({
    id: 'q1',
    status: 'user_blocked',
    userBlocker: null,
    inputRequest: null,
    title: 'Test Quest',
    description: '',
    acceptanceCriteria: [],
    edgeCases: [],
    context: '',
    epicId: null,
    projectId: null,
    adventurerId: null,
    agentId: null,
    equipment: { skillIds: [], toolIds: [], mcpServerIds: [] },
    specAudit: null,
    failureSummary: null,
    currentScene: 'quest-forest',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useQuestStream', () => {
  it('returns connecting status initially', () => {
    const { result } = renderHook(() => useQuestStream('q1'));
    expect(result.current.status).toBe('connecting');
  });

  it('updates status to connected via onConnectionChange', () => {
    const { result } = renderHook(() => useQuestStream('q1'));

    act(() => {
      mockConnects[0].onConnectionChange?.('connected');
    });

    expect(result.current.status).toBe('connected');
  });

  it('closes the socket on unmount', () => {
    const { unmount } = renderHook(() => useQuestStream('q1'));
    unmount();
    expect(mockCloses[0]).toHaveBeenCalledTimes(1);
  });

  it('appends progress events to the quest store', () => {
    renderHook(() => useQuestStream('q1'));

    const event: AgentEvent = {
      type: 'progress',
      timestamp: new Date().toISOString(),
      message: 'slaying',
    };

    act(() => {
      mockConnects[0].onEvent(event);
    });

    expect(useQuestStore.getState().entriesByQuest['q1']).toHaveLength(1);
    expect(useQuestStore.getState().entriesByQuest['q1'][0]).toMatchObject(event);
  });

  it('calls sceneRouter.goToScene and updates store on scene_change', () => {
    renderHook(() => useQuestStream('q1'));

    const event: AgentEvent = {
      type: 'scene_change',
      timestamp: new Date().toISOString(),
      from: 'quest-forest',
      to: 'quest-cave',
    };

    act(() => {
      mockConnects[0].onEvent(event);
    });

    expect(vi.mocked(sceneRouter.goToScene)).toHaveBeenCalledWith('quest-cave');
    expect(useQuestStore.getState().currentSceneByQuest['q1']).toBe('quest-cave');
  });

  it('updates store status on status_change', () => {
    renderHook(() => useQuestStream('q1'));

    const event: AgentEvent = {
      type: 'status_change',
      timestamp: new Date().toISOString(),
      from: 'active',
      to: 'complete',
    };

    act(() => {
      mockConnects[0].onEvent(event);
    });

    expect(useQuestStore.getState().statusByQuest['q1']).toBe('complete');
  });

  it('sets status to complete and invalidates query on completed event', () => {
    renderHook(() => useQuestStream('q1'));

    const event: AgentEvent = {
      type: 'completed',
      timestamp: new Date().toISOString(),
      summary: 'The dragon is slain.',
    };

    act(() => {
      mockConnects[0].onEvent(event);
    });

    expect(useQuestStore.getState().statusByQuest['q1']).toBe('complete');
    expect(useQuestStore.getState().entriesByQuest['q1']).toHaveLength(1);
    expect(useQuestStore.getState().entriesByQuest['q1'][0]).toMatchObject(event);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['quest', 'q1'] });
  });

  it('sets status to failed and invalidates query on failed event', () => {
    renderHook(() => useQuestStream('q1'));

    const event: AgentEvent = {
      type: 'failed',
      timestamp: new Date().toISOString(),
      reason: 'The party was defeated.',
    };

    act(() => {
      mockConnects[0].onEvent(event);
    });

    expect(useQuestStore.getState().statusByQuest['q1']).toBe('failed');
    expect(useQuestStore.getState().entriesByQuest['q1']).toHaveLength(1);
    expect(useQuestStore.getState().entriesByQuest['q1'][0]).toMatchObject(event);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['quest', 'q1'] });
  });

  it('exposes parseError when onParseError is called', () => {
    const { result } = renderHook(() => useQuestStream('q1'));

    act(() => {
      mockConnects[0].onParseError?.('Malformed AgentEvent payload');
    });

    expect(result.current.parseError).toBe('Malformed AgentEvent payload');
  });

  it('clears parseError when a valid event arrives after a bad frame', () => {
    const { result } = renderHook(() => useQuestStream('q1'));

    act(() => {
      mockConnects[0].onParseError?.('Bad frame');
    });
    expect(result.current.parseError).toBe('Bad frame');

    act(() => {
      mockConnects[0].onEvent({
        type: 'progress',
        timestamp: new Date().toISOString(),
        message: 'recovered',
      });
    });

    expect(result.current.parseError).toBeNull();
  });

  it('clears parseError when questId changes', () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useQuestStream(id),
      { initialProps: { id: 'q1' } },
    );

    act(() => {
      mockConnects[0].onParseError?.('Bad frame on q1');
    });
    expect(result.current.parseError).toBe('Bad frame on q1');

    rerender({ id: 'q2' });

    expect(result.current.parseError).toBeNull();
  });

  it('creates a new socket when questId changes', () => {
    const { rerender } = renderHook(
      ({ id }: { id: string }) => useQuestStream(id),
      { initialProps: { id: 'q1' } },
    );

    rerender({ id: 'q2' });

    expect(mockConnects).toHaveLength(2);
    // Old socket should be closed
    expect(mockCloses[0]).toHaveBeenCalledTimes(1);
  });

  it('calls encounterStore.handleAgentEvent for every incoming event', () => {
    renderHook(() => useQuestStream('q1'));

    const event: AgentEvent = {
      type: 'progress',
      timestamp: new Date().toISOString(),
      message: 'adventuring',
    };

    act(() => {
      mockConnects[0].onEvent(event);
    });

    expect(mockHandleAgentEvent).toHaveBeenCalledWith('q1', event);
  });

  it('calls encounterStore.handleAgentEvent for monster_appeared', () => {
    renderHook(() => useQuestStream('q1'));

    const event: AgentEvent = {
      type: 'monster_appeared',
      timestamp: new Date().toISOString(),
      encounterId: 'enc-1',
      monsterId: 'mon-1',
      monsterName: 'Goblin',
      monsterTypeId: 'goblin_linter',
      spritePath: 'monsters/goblin.png',
      difficulty: 1,
    };

    act(() => {
      mockConnects[0].onEvent(event);
    });

    expect(mockHandleAgentEvent).toHaveBeenCalledWith('q1', event);
  });

  it('invalidates monsters query cache on monster_appeared', () => {
    renderHook(() => useQuestStream('q1'));

    const event: AgentEvent = {
      type: 'monster_appeared',
      timestamp: new Date().toISOString(),
      encounterId: 'enc-2',
      monsterId: 'mon-2',
      monsterName: 'Troll',
      monsterTypeId: 'troll_debt',
      spritePath: 'monsters/troll.png',
      difficulty: 2,
    };

    act(() => {
      mockConnects[0].onEvent(event);
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['monsters'] });
  });

  it('calls encounterStore.handleAgentEvent for monster_resolved', () => {
    renderHook(() => useQuestStream('q1'));

    const event: AgentEvent = {
      type: 'monster_resolved',
      timestamp: new Date().toISOString(),
      encounterId: 'enc-1',
      outcome: 'victory',
    };

    act(() => {
      mockConnects[0].onEvent(event);
    });

    expect(mockHandleAgentEvent).toHaveBeenCalledWith('q1', event);
  });

  // ---------------------------------------------------------------------------
  // paused_input event
  // ---------------------------------------------------------------------------

  it('sets inputRequest in store on paused_input event', () => {
    renderHook(() => useQuestStream('q1'));

    const event: AgentEvent = {
      type: 'paused_input',
      timestamp: '2024-01-01T12:00:00.000Z',
      question: 'Which API key should I use?',
      context: 'Deploying to staging',
      adventureFraming: 'The oracle speaks...',
    };

    act(() => {
      mockConnects[0].onEvent(event);
    });

    const stored = useQuestStore.getState().inputRequestByQuest['q1'];
    expect(stored).not.toBeNull();
    expect(stored?.question).toBe('Which API key should I use?');
    expect(stored?.context).toBe('Deploying to staging');
    expect(stored?.adventureFraming).toBe('The oracle speaks...');
    expect(stored?.awaitingSince).toBe('2024-01-01T12:00:00.000Z');
  });

  it('sets inputRequest without optional fields on paused_input event', () => {
    renderHook(() => useQuestStream('q1'));

    const event: AgentEvent = {
      type: 'paused_input',
      timestamp: '2024-01-01T12:00:00.000Z',
      question: 'Proceed?',
    };

    act(() => {
      mockConnects[0].onEvent(event);
    });

    const stored = useQuestStore.getState().inputRequestByQuest['q1'];
    expect(stored?.question).toBe('Proceed?');
    expect(stored?.awaitingSince).toBe('2024-01-01T12:00:00.000Z');
    expect(stored?.context).toBeUndefined();
    expect(stored?.adventureFraming).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // resumed event
  // ---------------------------------------------------------------------------

  it('clears inputRequest and userBlocker on resumed event', () => {
    renderHook(() => useQuestStream('q1'));

    // First set some state
    useQuestStore.getState().setInputRequest('q1', {
      question: 'Proceed?',
      awaitingSince: '2024-01-01T12:00:00.000Z',
    });
    useQuestStore.getState().setUserBlocker('q1', {
      rawDescription: 'Blocked',
      markedAt: '2024-01-01T12:00:00.000Z',
    });

    act(() => {
      mockConnects[0].onEvent({
        type: 'resumed',
        timestamp: new Date().toISOString(),
        source: 'input_response',
      });
    });

    expect(useQuestStore.getState().inputRequestByQuest['q1']).toBeNull();
    expect(useQuestStore.getState().userBlockerByQuest['q1']).toBeNull();
  });

  it('resumed with source=user_unblock clears both fields', () => {
    renderHook(() => useQuestStream('q1'));

    useQuestStore.getState().setUserBlocker('q1', {
      rawDescription: 'Blocked by external dep',
      markedAt: '2024-01-01T12:00:00.000Z',
    });

    act(() => {
      mockConnects[0].onEvent({
        type: 'resumed',
        timestamp: new Date().toISOString(),
        source: 'user_unblock',
      });
    });

    expect(useQuestStore.getState().userBlockerByQuest['q1']).toBeNull();
    expect(useQuestStore.getState().inputRequestByQuest['q1']).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // status_change → user_blocked
  // ---------------------------------------------------------------------------

  it('invalidates quest query on status_change to user_blocked', () => {
    renderHook(() => useQuestStream('q1'));

    act(() => {
      mockConnects[0].onEvent({
        type: 'status_change',
        timestamp: new Date().toISOString(),
        from: 'active',
        to: 'user_blocked',
      });
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['quest', 'q1'] });
  });

  it('sets status in store on status_change to user_blocked', () => {
    renderHook(() => useQuestStream('q1'));

    act(() => {
      mockConnects[0].onEvent({
        type: 'status_change',
        timestamp: new Date().toISOString(),
        from: 'active',
        to: 'user_blocked',
      });
    });

    expect(useQuestStore.getState().statusByQuest['q1']).toBe('user_blocked');
  });

  it('silently ignores API error when refetching quest on user_blocked', async () => {
    mockQuestGet.mockRejectedValue(new Error('Network error'));

    renderHook(() => useQuestStream('q1'));

    await act(async () => {
      mockConnects[0].onEvent({
        type: 'status_change',
        timestamp: new Date().toISOString(),
        from: 'active',
        to: 'user_blocked',
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    // Should not throw; userBlocker was never set (API error, so stays undefined/null)
    expect(useQuestStore.getState().userBlockerByQuest['q1'] ?? null).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // status_change → active
  // ---------------------------------------------------------------------------

  it('clears inputRequest and userBlocker on status_change to active', () => {
    renderHook(() => useQuestStream('q1'));

    useQuestStore.getState().setInputRequest('q1', {
      question: 'Proceed?',
      awaitingSince: '2024-01-01T12:00:00.000Z',
    });
    useQuestStore.getState().setUserBlocker('q1', {
      rawDescription: 'Blocked',
      markedAt: '2024-01-01T12:00:00.000Z',
    });

    act(() => {
      mockConnects[0].onEvent({
        type: 'status_change',
        timestamp: new Date().toISOString(),
        from: 'paused_input',
        to: 'active',
      });
    });

    expect(useQuestStore.getState().inputRequestByQuest['q1']).toBeNull();
    expect(useQuestStore.getState().userBlockerByQuest['q1']).toBeNull();
    expect(useQuestStore.getState().statusByQuest['q1']).toBe('active');
  });

  it('does not clear modal state on status_change to non-active statuses', () => {
    renderHook(() => useQuestStream('q1'));

    useQuestStore.getState().setInputRequest('q1', {
      question: 'Proceed?',
      awaitingSince: '2024-01-01T12:00:00.000Z',
    });

    act(() => {
      mockConnects[0].onEvent({
        type: 'status_change',
        timestamp: new Date().toISOString(),
        from: 'active',
        to: 'complete',
      });
    });

    // inputRequest should remain (only cleared on active or resumed)
    expect(useQuestStore.getState().inputRequestByQuest['q1']).not.toBeNull();
  });
});
