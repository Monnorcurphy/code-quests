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
});
