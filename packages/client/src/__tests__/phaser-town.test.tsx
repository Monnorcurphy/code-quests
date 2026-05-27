import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { PhaserTown } from '../routes/town';
import { sceneRouter } from '../game/scene-router';
import type { SceneNavItem } from '../game/scene-router';

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
  },
}));

function makeRouter(initialPath: string) {
  return createMemoryRouter(
    [
      { path: '/town', element: <PhaserTown /> },
      { path: '/town/:sceneKey', element: <PhaserTown /> },
    ],
    { initialEntries: [initialPath] },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sceneRouter.onDoorEnter).mockReturnValue(vi.fn());
  vi.mocked(sceneRouter.onInteractivesChange).mockReturnValue(vi.fn());
});

describe('PhaserTown URL routing', () => {
  it('passes initialScene from URL param to PhaserMount', async () => {
    const router = makeRouter('/town/war-room');
    render(<RouterProvider router={router} />);

    const mount = await screen.findByTestId('phaser-mount');
    expect(mount.getAttribute('data-initial-scene')).toBe('war-room');
  });

  it('falls back to "boot" for an unknown sceneKey', async () => {
    const router = makeRouter('/town/unknown-scene');
    render(<RouterProvider router={router} />);

    const mount = await screen.findByTestId('phaser-mount');
    expect(mount.getAttribute('data-initial-scene')).toBe('boot');
  });

  it('does not call goToScene on the initial render (hasMounted skip)', async () => {
    const router = makeRouter('/town/war-room');
    render(<RouterProvider router={router} />);
    await screen.findByTestId('phaser-mount');

    expect(vi.mocked(sceneRouter.goToScene)).not.toHaveBeenCalled();
  });

  it('navigates to the correct URL when doorEnter fires', async () => {
    const router = makeRouter('/town/war-room');
    render(<RouterProvider router={router} />);
    await screen.findByTestId('phaser-mount');

    const doorEnterCallback = vi.mocked(sceneRouter.onDoorEnter).mock.calls[0][0];
    await act(() => {
      doorEnterCallback({ sceneKey: 'guild-hall', spawnX: 300 });
    });

    expect(router.state.location.pathname).toBe('/town/guild-hall');
    expect(router.state.location.state).toEqual({ spawnX: 300 });
  });

  it('calls goToScene when URL changes after initial mount', async () => {
    const router = makeRouter('/town/town-square');
    render(<RouterProvider router={router} />);
    await screen.findByTestId('phaser-mount');

    await act(() => router.navigate('/town/war-room', { state: { spawnX: 400 } }));

    expect(vi.mocked(sceneRouter.goToScene)).toHaveBeenCalledWith('war-room', { spawnX: 400 });
  });

  it('calls goToScene with spawnX undefined when navigating without state (e.g. refresh)', async () => {
    const router = makeRouter('/town/town-square');
    render(<RouterProvider router={router} />);
    await screen.findByTestId('phaser-mount');

    await act(() => router.navigate('/town/oracle'));

    expect(vi.mocked(sceneRouter.goToScene)).toHaveBeenCalledWith('oracle', { spawnX: undefined });
  });
});

describe('PhaserTown scene-keyboard-nav interactives', () => {
  it('renders nav items when the scene publishes its interactives', async () => {
    const router = makeRouter('/town/town-square');
    render(<RouterProvider router={router} />);
    await screen.findByTestId('phaser-mount');

    const interactivesHandler = vi.mocked(sceneRouter.onInteractivesChange).mock
      .calls[0][0] as (items: SceneNavItem[]) => void;

    await act(() => {
      interactivesHandler([
        { id: 'guild-hall', label: 'Enter Guild Hall', onActivate: vi.fn() },
        { id: 'war-room', label: 'Enter War Room', onActivate: vi.fn() },
      ]);
    });

    expect(screen.getByRole('button', { name: 'Enter Guild Hall' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Enter War Room' })).toBeDefined();
  });

  it('fires the same onActivate as the in-canvas Enter when a nav item is clicked', async () => {
    const user = userEvent.setup();
    const router = makeRouter('/town/town-square');
    render(<RouterProvider router={router} />);
    await screen.findByTestId('phaser-mount');

    const interactivesHandler = vi.mocked(sceneRouter.onInteractivesChange).mock
      .calls[0][0] as (items: SceneNavItem[]) => void;

    const mockActivate = vi.fn();
    await act(() => {
      interactivesHandler([{ id: 'guild-hall', label: 'Enter Guild Hall', onActivate: mockActivate }]);
    });

    await user.click(screen.getByRole('button', { name: 'Enter Guild Hall' }));

    expect(mockActivate).toHaveBeenCalledOnce();
  });

  it('shows no nav items before the scene publishes interactives', async () => {
    const router = makeRouter('/town/town-square');
    render(<RouterProvider router={router} />);
    await screen.findByTestId('phaser-mount');

    expect(screen.queryByRole('navigation', { name: 'Scene interactions' })).toBeNull();
  });

  it('clears nav items when the scene shuts down', async () => {
    const router = makeRouter('/town/town-square');
    render(<RouterProvider router={router} />);
    await screen.findByTestId('phaser-mount');

    const interactivesHandler = vi.mocked(sceneRouter.onInteractivesChange).mock
      .calls[0][0] as (items: SceneNavItem[]) => void;

    await act(() => {
      interactivesHandler([{ id: 'guild-hall', label: 'Enter Guild Hall', onActivate: vi.fn() }]);
    });
    expect(screen.getByRole('button', { name: 'Enter Guild Hall' })).toBeDefined();

    await act(() => {
      interactivesHandler([]);
    });
    expect(screen.queryByRole('button', { name: 'Enter Guild Hall' })).toBeNull();
  });
});
