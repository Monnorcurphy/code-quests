import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import QuestRoute from '../routes/quest';
import { api, ApiError } from '../lib/api';
import { sceneRouter } from '../game/scene-router';
import type { Quest } from '@code-quests/shared';

vi.mock('../game/phaser-mount', () => ({
  default: ({ initialScene }: { initialScene: string }) => (
    <div data-testid="phaser-mount" data-initial-scene={initialScene} />
  ),
}));

vi.mock('../game/scene-router', () => ({
  sceneRouter: {
    onSceneAdvance: vi.fn().mockReturnValue(vi.fn()),
    goToScene: vi.fn(),
  },
}));

vi.mock('../features/quest/use-quest-stream', () => ({
  useQuestStream: vi.fn().mockReturnValue({ status: 'connected', parseError: null }),
}));

vi.mock('../lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/api')>();
  return {
    ...original,
    api: {
      ...original.api,
      quests: {
        ...original.api.quests,
        get: vi.fn(),
        advanceScene: vi.fn(),
      },
      adventurers: {
        ...original.api.adventurers,
        get: vi.fn(),
      },
    },
  };
});

function makeQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 'q-1',
    epicId: null,
    projectId: null,
    title: 'Slay the Shadow',
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

function renderRoute(questId = 'q-1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: '/quest/:questId', element: <QuestRoute /> }],
    { initialEntries: [`/quest/${questId}`] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sceneRouter.onSceneAdvance).mockReturnValue(vi.fn());
  vi.mocked(api.adventurers.get).mockResolvedValue({
    id: 'adv-1',
    name: 'Thorin',
    class: 'champion' as const,
    modelId: 'claude-opus-4-7',
    createdAt: new Date().toISOString(),
    stats: {},
    specializations: [],
    scars: [],
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('QuestRoute', () => {
  it('renders loading state before data arrives', () => {
    vi.mocked(api.quests.get).mockImplementation(() => new Promise(() => {}));
    renderRoute();
    expect(screen.getByText(/loading quest/i)).toBeDefined();
  });

  it('renders the quest scene via PhaserMount with initial scene', async () => {
    vi.mocked(api.quests.get).mockResolvedValue(makeQuest({ currentScene: 'quest-forest' }));
    renderRoute();
    const mount = await screen.findByTestId('phaser-mount');
    expect(mount.getAttribute('data-initial-scene')).toBe('quest-forest');
  });

  it('passes the correct non-forest scene to PhaserMount', async () => {
    vi.mocked(api.quests.get).mockResolvedValue(makeQuest({ currentScene: 'quest-cave' }));
    renderRoute();
    const mount = await screen.findByTestId('phaser-mount');
    expect(mount.getAttribute('data-initial-scene')).toBe('quest-cave');
  });

  it('shows empty state when API returns 404', async () => {
    vi.mocked(api.quests.get).mockRejectedValue(
      new ApiError('Quest not found', { status: 404 }),
    );
    renderRoute();
    await waitFor(() => {
      expect(screen.getByText(/quest not found/i)).toBeDefined();
    });
  });

  it('shows error state when API fails with non-404 error', async () => {
    vi.mocked(api.quests.get).mockRejectedValue(new Error('Network error'));
    renderRoute();
    await waitFor(() => {
      expect(screen.getByText(/could not load quest/i)).toBeDefined();
    });
  });

  it('clicking Return-to-Town navigates to /town/town-square', async () => {
    const user = userEvent.setup();
    vi.mocked(api.quests.get).mockResolvedValue(makeQuest());
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const router = createMemoryRouter(
      [
        { path: '/quest/:questId', element: <QuestRoute /> },
        { path: '/town/:sceneKey', element: <div data-testid="town" /> },
      ],
      { initialEntries: ['/quest/q-1'] },
    );
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    const returnBtn = await screen.findByRole('button', { name: /return to town/i });
    await user.click(returnBtn);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/town/town-square');
    });
  });

  it('HUD displays quest title', async () => {
    vi.mocked(api.quests.get).mockResolvedValue(makeQuest({ title: 'Slay the Shadow' }));
    renderRoute();
    await waitFor(() => {
      expect(screen.getByText('Slay the Shadow')).toBeDefined();
    });
  });

  it('HUD displays adventurer name from API', async () => {
    vi.mocked(api.quests.get).mockResolvedValue(makeQuest({ adventurerId: 'adv-1' }));
    vi.mocked(api.adventurers.get).mockResolvedValue({
      id: 'adv-1',
      name: 'Thorin',
      class: 'champion' as const,
      modelId: 'claude-opus-4-7',
      createdAt: new Date().toISOString(),
      stats: {},
      specializations: [],
      scars: [],
    });
    renderRoute();
    await waitFor(() => {
      expect(screen.getByText('Thorin')).toBeDefined();
    });
  });

  it('HUD displays quest status', async () => {
    vi.mocked(api.quests.get).mockResolvedValue(makeQuest({ status: 'active' }));
    renderRoute();
    await waitFor(() => {
      expect(screen.getByText('Active')).toBeDefined();
    });
  });

  it('calls sceneRouter.onSceneAdvance on mount and cleans up on unmount', async () => {
    const unsubscribe = vi.fn();
    vi.mocked(sceneRouter.onSceneAdvance).mockReturnValue(unsubscribe);
    vi.mocked(api.quests.get).mockResolvedValue(makeQuest());
    const { unmount } = renderRoute();
    await screen.findByTestId('phaser-mount');
    expect(vi.mocked(sceneRouter.onSceneAdvance)).toHaveBeenCalled();
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('empty-state return button navigates to /town/town-square', async () => {
    const user = userEvent.setup();
    vi.mocked(api.quests.get).mockRejectedValue(
      new ApiError('Quest not found', { status: 404 }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const router = createMemoryRouter(
      [
        { path: '/quest/:questId', element: <QuestRoute /> },
        { path: '/town/:sceneKey', element: <div data-testid="town" /> },
      ],
      { initialEntries: ['/quest/q-999'] },
    );
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    const btn = await screen.findByRole('button', { name: /return to town/i });
    await user.click(btn);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/town/town-square');
    });
  });
});
