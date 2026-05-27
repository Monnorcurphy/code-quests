import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PhaserTown } from '../routes/town';
import { useTownStore } from '../stores/town-store';
import { sceneRouter } from '../game/scene-router';

vi.mock('../game/phaser-mount', () => ({
  default: ({ initialScene }: { initialScene: string }) => (
    <div data-testid="phaser-mount" data-initial-scene={initialScene} />
  ),
}));

vi.mock('../game/scene-router', () => ({
  sceneRouter: {
    onDoorEnter: vi.fn().mockReturnValue(vi.fn()),
    goToScene: vi.fn(),
    onInteractivesChange: vi.fn().mockReturnValue(vi.fn()),
    emitDoorEnter: vi.fn(),
  },
}));

vi.mock('../lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/api')>();
  return {
    ...original,
    api: {
      adventurers: { list: vi.fn().mockResolvedValue([]) },
      quests: { list: vi.fn().mockResolvedValue([]), create: vi.fn() },
      epics: { list: vi.fn().mockResolvedValue([]) },
    },
  };
});

function makeRouter(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    router: createMemoryRouter(
      [{ path: '/town/:sceneKey', element: <PhaserTown /> }],
      { initialEntries: [initialPath] },
    ),
    queryClient,
  };
}

function renderAtPath(initialPath: string) {
  const { router, queryClient } = makeRouter(initialPath);
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sceneRouter.onDoorEnter).mockReturnValue(vi.fn());
  vi.mocked(sceneRouter.onInteractivesChange).mockReturnValue(vi.fn());
  useTownStore.setState({ activeModal: null });
});

afterEach(() => {
  useTownStore.setState({ activeModal: null });
});

describe('Town — Phaser mode', () => {
  it('renders the Phaser mount', async () => {
    renderAtPath('/town/town-square');
    expect(await screen.findByTestId('phaser-mount')).toBeDefined();
  });

  it('renders the settings button', async () => {
    renderAtPath('/town/town-square');
    await screen.findByTestId('phaser-mount');
    expect(screen.getByRole('button', { name: 'Open settings' })).toBeDefined();
  });

  it('opens the settings panel when the settings button is clicked', async () => {
    const user = userEvent.setup();
    renderAtPath('/town/town-square');
    await screen.findByTestId('phaser-mount');

    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeDefined();
  });

  it('settings panel closes on Escape', async () => {
    const user = userEvent.setup();
    renderAtPath('/town/town-square');
    await screen.findByTestId('phaser-mount');

    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeDefined();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull();
  });

  it('renders the quest-board overlay when activeModal is quest-board', async () => {
    renderAtPath('/town/town-square');
    await screen.findByTestId('phaser-mount');

    await act(() => {
      useTownStore.setState({ activeModal: 'quest-board' });
    });

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Town Square', level: 2 })).toBeDefined();
  });

  it('renders the draft overlay when activeModal is draft', async () => {
    renderAtPath('/town/war-room');
    await screen.findByTestId('phaser-mount');

    await act(() => {
      useTownStore.setState({ activeModal: 'draft' });
    });

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'War Room', level: 2 })).toBeDefined();
  });

  it('renders the guild-hall overlay when activeModal is guild-hall', async () => {
    renderAtPath('/town/guild-hall');
    await screen.findByTestId('phaser-mount');

    await act(() => {
      useTownStore.setState({ activeModal: 'guild-hall' });
    });

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Guild Hall', level: 2 })).toBeDefined();
  });

  it('renders coming-soon overlay for placeholder scene when activeModal is coming-soon', async () => {
    renderAtPath('/town/hall-of-returns');
    await screen.findByTestId('phaser-mount');

    await act(() => {
      useTownStore.setState({ activeModal: 'coming-soon' });
    });

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Hall of Returns', level: 2 })).toBeDefined();
  });

  it('renders the aria-live heading for the current building', async () => {
    renderAtPath('/town/war-room');
    await screen.findByTestId('phaser-mount');
    expect(screen.getByText('War Room')).toBeDefined();
  });
});
