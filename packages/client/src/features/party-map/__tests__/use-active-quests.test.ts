import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useActiveQuests } from '../use-active-quests';
import { useQuestStore } from '../../../stores/quest-store';
import { api } from '../../../lib/api';
import type { Quest } from '@code-quests/shared';

vi.mock('../../../lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../lib/api')>();
  return {
    ...original,
    api: {
      ...original.api,
      quests: {
        ...original.api.quests,
        active: vi.fn(),
      },
    },
  };
});

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
    adventurerId: 'adv-1',
    agentId: null,
    equipment: { skillIds: [], toolIds: [], mcpServerIds: [] },
    specAudit: null,
    failureSummary: null,
    inputRequest: null,
    userBlocker: null,
    currentScene: 'quest-forest' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  useQuestStore.setState({
    _nextId: 0,
    entriesByQuest: {},
    currentSceneByQuest: {},
    statusByQuest: {},
  });
});

describe('useActiveQuests', () => {
  it('returns empty entries when API returns empty array', async () => {
    vi.mocked(api.quests.active).mockResolvedValue([]);
    const { result } = renderHook(() => useActiveQuests(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entries).toHaveLength(0);
  });

  it('returns entries for active quests', async () => {
    const quest = makeQuest({ id: 'q-1', status: 'active' });
    vi.mocked(api.quests.active).mockResolvedValue([quest]);
    const { result } = renderHook(() => useActiveQuests(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].quest.id).toBe('q-1');
    expect(result.current.entries[0].currentScene).toBe('quest-forest');
    expect(result.current.entries[0].status).toBe('active');
  });

  it('passes through all quests returned by the API endpoint', async () => {
    const q1 = makeQuest({ id: 'q-1', status: 'active' });
    const q2 = makeQuest({ id: 'q-2', status: 'paused_input' });
    vi.mocked(api.quests.active).mockResolvedValue([q1, q2]);
    const { result } = renderHook(() => useActiveQuests(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entries).toHaveLength(2);
  });

  it('merges currentScene from store over API value', async () => {
    const quest = makeQuest({ id: 'q-1', currentScene: 'quest-forest' });
    vi.mocked(api.quests.active).mockResolvedValue([quest]);
    useQuestStore.setState((s) => ({
      currentSceneByQuest: { ...s.currentSceneByQuest, 'q-1': 'quest-cave' },
    }));
    const { result } = renderHook(() => useActiveQuests(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entries[0].currentScene).toBe('quest-cave');
  });

  it('merges status from store over API value', async () => {
    const quest = makeQuest({ id: 'q-1', status: 'active' });
    vi.mocked(api.quests.active).mockResolvedValue([quest]);
    useQuestStore.setState((s) => ({
      statusByQuest: { ...s.statusByQuest, 'q-1': 'paused_input' },
    }));
    const { result } = renderHook(() => useActiveQuests(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entries[0].status).toBe('paused_input');
  });

  it('falls back to API value when store has no entry', async () => {
    const quest = makeQuest({ id: 'q-1', currentScene: 'quest-dungeon' });
    vi.mocked(api.quests.active).mockResolvedValue([quest]);
    const { result } = renderHook(() => useActiveQuests(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entries[0].currentScene).toBe('quest-dungeon');
  });

  it('returns isLoading true while fetch is pending', () => {
    vi.mocked(api.quests.active).mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useActiveQuests(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });
});
