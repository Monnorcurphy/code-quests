import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HUDOverlayManager } from '../hud-overlay-manager';
import { useTownStore } from '../../stores/town-store';

vi.mock('../../game/scene-router', () => ({
  sceneRouter: {
    emitDoorEnter: vi.fn(),
  },
}));

vi.mock('../../lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...original,
    api: {
      adventurers: { list: vi.fn().mockResolvedValue([]) },
      quests: { list: vi.fn().mockResolvedValue([]), get: vi.fn(), create: vi.fn(), patch: vi.fn() },
      epics: { list: vi.fn().mockResolvedValue([]) },
      equipment: {
        skills: vi.fn().mockResolvedValue([]),
        tools: vi.fn().mockResolvedValue([]),
        mcpServers: vi.fn().mockResolvedValue([]),
      },
    },
  };
});

function renderAtScene(sceneKey: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [{ path: '/town/:sceneKey', element: <HUDOverlayManager /> }],
    { initialEntries: [`/town/${sceneKey}`] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useTownStore.setState({ activeModal: null });
});

afterEach(() => {
  useTownStore.setState({ activeModal: null });
});

describe('HUDOverlayManager', () => {
  it('renders nothing when activeModal is null', () => {
    renderAtScene('town-square');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders TownSquare when activeModal is quest-board', async () => {
    renderAtScene('town-square');
    await act(() => { useTownStore.setState({ activeModal: 'quest-board' }); });
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Town Square', level: 2 })).toBeDefined();
  });

  it('renders TownSquare when activeModal is recruit', async () => {
    renderAtScene('town-square');
    await act(() => { useTownStore.setState({ activeModal: 'recruit' }); });
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('renders WarRoom when activeModal is draft', async () => {
    renderAtScene('war-room');
    await act(() => { useTownStore.setState({ activeModal: 'draft' }); });
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'War Room', level: 2 })).toBeDefined();
  });

  it('renders GuildHall when activeModal is guild-hall', async () => {
    renderAtScene('guild-hall');
    await act(() => { useTownStore.setState({ activeModal: 'guild-hall' }); });
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Guild Hall', level: 2 })).toBeDefined();
  });

  it('renders Oracle panel when activeModal is oracle', async () => {
    renderAtScene('oracle');
    await act(() => { useTownStore.setState({ activeModal: 'oracle' }); });
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('heading', { name: /oracle/i, level: 2 })).toBeDefined();
  });

  it('renders Library panel when activeModal is library', async () => {
    renderAtScene('library');
    await act(() => { useTownStore.setState({ activeModal: 'library' }); });
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('heading', { name: /library/i, level: 2 })).toBeDefined();
  });

  it('renders Tavern panel when activeModal is tavern', async () => {
    renderAtScene('tavern');
    await act(() => { useTownStore.setState({ activeModal: 'tavern' }); });
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('heading', { name: /tavern/i, level: 2 })).toBeDefined();
  });

  it('renders LoadoutPanel when activeModal is armory-loadout', async () => {
    renderAtScene('armory');
    await act(() => { useTownStore.setState({ activeModal: 'armory-loadout' }); });
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Armory — Equipment Loadout', level: 2 })).toBeDefined();
  });

  it('renders ComingSoonPanel for hall-of-returns when activeModal is coming-soon', async () => {
    renderAtScene('hall-of-returns');
    await act(() => { useTownStore.setState({ activeModal: 'coming-soon' }); });
    expect(screen.getByRole('heading', { name: 'Hall of Returns', level: 2 })).toBeDefined();
  });

  it('does not render ComingSoonPanel when sceneKey has no coming-soon content', async () => {
    renderAtScene('town-square');
    await act(() => { useTownStore.setState({ activeModal: 'coming-soon' }); });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes quest-board overlay with Escape', async () => {
    const user = userEvent.setup();
    renderAtScene('town-square');
    await act(() => { useTownStore.setState({ activeModal: 'quest-board' }); });
    expect(screen.getByRole('dialog')).toBeDefined();

    await user.keyboard('{Escape}');
    expect(useTownStore.getState().activeModal).toBeNull();
  });
});
