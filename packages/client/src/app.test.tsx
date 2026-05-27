import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import App from './app';

vi.mock('./game/phaser-mount', () => ({
  default: ({ initialScene }: { initialScene: string }) => (
    <div data-testid="phaser-mount" data-initial-scene={initialScene} />
  ),
}));

vi.mock('./game/scene-router', () => ({
  sceneRouter: {
    onDoorEnter: vi.fn().mockReturnValue(vi.fn()),
    goToScene: vi.fn(),
    onInteractivesChange: vi.fn().mockReturnValue(vi.fn()),
  },
}));

function renderApp(initialPath = '/town/town-square') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('App', () => {
  it('renders the Phaser mount at /town/town-square', async () => {
    renderApp('/town/town-square');
    expect(await screen.findByTestId('phaser-mount')).toBeDefined();
  });

  it('redirects /town to /town/town-square and renders PhaserMount', async () => {
    renderApp('/town');
    expect(await screen.findByTestId('phaser-mount')).toBeDefined();
  });

  it('redirects unknown routes to /town/town-square and renders PhaserMount', async () => {
    renderApp('/unknown-route');
    expect(await screen.findByTestId('phaser-mount')).toBeDefined();
  });

  it('renders a main landmark', async () => {
    renderApp();
    expect(screen.getByRole('main')).toBeDefined();
  });

  it('renders the settings button', async () => {
    renderApp();
    expect(await screen.findByRole('button', { name: 'Open settings' })).toBeDefined();
  });
});
