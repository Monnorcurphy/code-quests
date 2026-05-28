import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HUDOverlay from '../hud-overlay';
import { useEncounterStore } from '../../../stores/encounter-store';
import type { Quest } from '@code-quests/shared';
import type { AgentEvent } from '@code-quests/shared';

vi.mock('../return-to-town-button', () => ({
  default: () => <button>Return to Town</button>,
}));

vi.mock('../../../lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../lib/api')>();
  return {
    ...original,
    api: {
      ...original.api,
      adventurers: { get: vi.fn().mockResolvedValue(null) },
    },
  };
});

vi.mock('../../../stores/quest-store', () => ({
  useQuestStore: vi.fn((selector: (s: object) => unknown) =>
    selector({ statusByQuest: {}, currentSceneByQuest: {}, entriesByQuest: {} }),
  ),
}));

function makeQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 'q-1',
    epicId: null,
    title: 'Test Quest',
    description: '',
    acceptanceCriteria: [],
    edgeCases: [],
    context: '',
    status: 'active',
    adventurerId: null,
    agentId: null,
    equipment: { skillIds: [], toolIds: [], mcpServerIds: [] },
    specAudit: null,
    failureSummary: null,
    currentScene: 'quest-forest' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeAppearedEvent(overrides: Partial<Extract<AgentEvent, { type: 'monster_appeared' }>> = {}): AgentEvent {
  return {
    type: 'monster_appeared',
    timestamp: new Date().toISOString(),
    encounterId: 'enc-1',
    monsterId: 'mon-1',
    monsterName: 'Goblin',
    monsterTypeId: 'goblin_linter',
    spritePath: '/assets/monsters/goblin.png',
    difficulty: 1,
    ...overrides,
  };
}

function renderHUD(questId = 'q-1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <HUDOverlay
        quest={makeQuest()}
        questId={questId}
        advanceLoading={false}
        advanceError={null}
        connectionStatus="connected"
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useEncounterStore.setState({ byQuest: {} });
});

afterEach(() => {
  useEncounterStore.setState({ byQuest: {} });
  vi.clearAllMocks();
});

describe('HUDOverlay encounter panel', () => {
  it('renders no encounter info when no encounter is active', () => {
    renderHUD('q-1');
    expect(screen.queryByRole('region', { name: /active encounter/i })).toBeDefined();
    expect(screen.queryByText('Goblin')).toBeNull();
  });

  it('shows monster name when encounter is active', () => {
    renderHUD('q-1');
    act(() => {
      useEncounterStore.getState().handleAgentEvent('q-1', makeAppearedEvent());
    });
    expect(screen.getByText('Goblin')).toBeDefined();
  });

  it('shows HP percentage when encounter is active', () => {
    renderHUD('q-1');
    act(() => {
      useEncounterStore.getState().handleAgentEvent('q-1', makeAppearedEvent());
    });
    expect(screen.getByText('100%')).toBeDefined();
  });

  it('shows difficulty stars matching the difficulty value', () => {
    renderHUD('q-1');
    act(() => {
      useEncounterStore.getState().handleAgentEvent('q-1', makeAppearedEvent({ difficulty: 3 }));
    });
    const starsEl = screen.getByLabelText(/difficulty 3 out of 5/i);
    expect(starsEl.textContent).toBe('★★★☆☆');
  });

  it('shows full 5 stars for difficulty 5', () => {
    renderHUD('q-1');
    act(() => {
      useEncounterStore.getState().handleAgentEvent('q-1', makeAppearedEvent({ difficulty: 5 }));
    });
    const starsEl = screen.getByLabelText(/difficulty 5 out of 5/i);
    expect(starsEl.textContent).toBe('★★★★★');
  });

  it('shows 1 star for difficulty 1', () => {
    renderHUD('q-1');
    act(() => {
      useEncounterStore.getState().handleAgentEvent('q-1', makeAppearedEvent({ difficulty: 1 }));
    });
    const starsEl = screen.getByLabelText(/difficulty 1 out of 5/i);
    expect(starsEl.textContent).toBe('★☆☆☆☆');
  });

  it('HP display updates after combat event', () => {
    renderHUD('q-1');
    act(() => {
      useEncounterStore.getState().handleAgentEvent('q-1', makeAppearedEvent());
    });
    act(() => {
      useEncounterStore.getState().handleAgentEvent('q-1', {
        type: 'combat',
        timestamp: new Date().toISOString(),
        message: 'attack',
      });
    });
    expect(screen.getByText('75%')).toBeDefined();
    expect(screen.queryByText('100%')).toBeNull();
  });

  it('shows sprite image with monster name as alt text', () => {
    renderHUD('q-1');
    act(() => {
      useEncounterStore.getState().handleAgentEvent('q-1', makeAppearedEvent({ monsterName: 'Dragon' }));
    });
    const img = screen.getByAltText('Dragon');
    expect(img).toBeDefined();
  });

  it('encounter info disappears after clearQuest', () => {
    renderHUD('q-1');
    act(() => {
      useEncounterStore.getState().handleAgentEvent('q-1', makeAppearedEvent());
    });
    expect(screen.getByText('Goblin')).toBeDefined();
    act(() => {
      useEncounterStore.getState().clearQuest('q-1');
    });
    expect(screen.queryByText('Goblin')).toBeNull();
  });

  it('shows encounter for correct questId only', () => {
    renderHUD('q-1');
    act(() => {
      useEncounterStore.getState().handleAgentEvent('q-2', makeAppearedEvent({ monsterName: 'Dragon' }));
    });
    expect(screen.queryByText('Dragon')).toBeNull();
  });

  it('encounter panel region is aria-live polite', () => {
    renderHUD('q-1');
    const region = screen.getByRole('region', { name: /active encounter/i });
    expect(region.getAttribute('aria-live')).toBe('polite');
  });
});
