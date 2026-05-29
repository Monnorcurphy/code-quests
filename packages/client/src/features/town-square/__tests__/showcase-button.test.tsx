import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ShowcaseButton from '../showcase-button';
import { useTourStore } from '../../../stores/tour-store';

// Mock the API
vi.mock('../../../lib/api', () => ({
  api: {
    showcase: {
      reset: vi.fn(),
    },
  },
}));

import { api } from '../../../lib/api';

function resetStore() {
  useTourStore.setState({ active: false, step: 1 });
}

function renderButton() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ShowcaseButton />
    </QueryClientProvider>,
  );
}

describe('ShowcaseButton', () => {
  beforeEach(() => {
    resetStore();
    // Simulate demo mode via window flag
    (window as unknown as Record<string, unknown>)['__DEMO_MODE__'] = true;
  });

  it('renders start button when demo mode is active', () => {
    renderButton();
    expect(screen.getByTestId('showcase-start-btn')).toBeDefined();
  });

  it('opens confirm modal on click', () => {
    renderButton();
    fireEvent.click(screen.getByTestId('showcase-start-btn'));
    expect(screen.getByTestId('showcase-confirm-modal')).toBeDefined();
    expect(screen.getByText(/reset your database/i)).toBeDefined();
  });

  it('Cancel closes the modal', () => {
    renderButton();
    fireEvent.click(screen.getByTestId('showcase-start-btn'));
    expect(screen.getByTestId('showcase-confirm-modal')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByTestId('showcase-confirm-modal')).toBeNull();
  });

  it('Start Demo calls api.showcase.reset and starts tour on success', async () => {
    vi.mocked(api.showcase.reset).mockResolvedValue({ epicId: 'epic-showcase-auth' });

    renderButton();
    fireEvent.click(screen.getByTestId('showcase-start-btn'));
    fireEvent.click(screen.getByRole('button', { name: /start demo/i }));

    await waitFor(() => {
      expect(useTourStore.getState().active).toBe(true);
    });
    expect(useTourStore.getState().step).toBe(1);
  });

  it('shows error message on reset failure', async () => {
    vi.mocked(api.showcase.reset).mockRejectedValue(new Error('Showcase reset is only available in demo mode'));

    renderButton();
    fireEvent.click(screen.getByTestId('showcase-start-btn'));
    fireEvent.click(screen.getByRole('button', { name: /start demo/i }));

    await waitFor(() => {
      expect(screen.getByText(/demo mode/i)).toBeDefined();
    });
    // Tour should NOT have started
    expect(useTourStore.getState().active).toBe(false);
  });

  it('hides button when not in demo mode', () => {
    delete (window as unknown as Record<string, unknown>)['__DEMO_MODE__'];
    // Also make sure VITE env isn't 'demo'
    renderButton();
    expect(screen.queryByTestId('showcase-start-btn')).toBeNull();
  });
});
