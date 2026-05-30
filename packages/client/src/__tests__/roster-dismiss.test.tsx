import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Roster from '../features/guild/roster';
import { api, ApiError } from '../lib/api';
import type { Adventurer } from '@code-quests/shared';

vi.mock('../lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/api')>();
  return {
    ...original,
    api: {
      ...original.api,
      adventurers: {
        list: vi.fn().mockResolvedValue([]),
        delete: vi.fn(),
      },
    },
  };
});

function makeAdv(id: string, name: string): Adventurer {
  return {
    id,
    name,
    class: 'ranger',
    modelId: 'default',
    createdAt: '2026-01-01',
    stats: {},
    specializations: [],
    scars: [],
    style: {},
  };
}

function renderRoster(adventurers: Adventurer[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    ...render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <Roster adventurers={adventurers} isLoading={false} error={null} />
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  };
}

describe('Roster dismiss adventurer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires confirm before deleting', async () => {
    const user = userEvent.setup();
    renderRoster([makeAdv('a1', 'Elara')]);

    await user.click(screen.getByRole('button', { name: /dismiss elara/i }));
    expect(screen.getByText(/dismiss\?/i)).toBeInTheDocument();
    expect(api.adventurers.delete).not.toHaveBeenCalled();
  });

  it('cancels confirmation without deleting', async () => {
    const user = userEvent.setup();
    renderRoster([makeAdv('a1', 'Elara')]);
    await user.click(screen.getByRole('button', { name: /dismiss elara/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText(/dismiss\?/i)).not.toBeInTheDocument();
    expect(api.adventurers.delete).not.toHaveBeenCalled();
  });

  it('deletes on confirm and invalidates the roster', async () => {
    const user = userEvent.setup();
    (api.adventurers.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const { queryClient } = renderRoster([makeAdv('a1', 'Elara')]);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    await user.click(screen.getByRole('button', { name: /dismiss elara/i }));
    await user.click(screen.getByRole('button', { name: /confirm dismiss elara/i }));

    await waitFor(() => {
      expect(api.adventurers.delete).toHaveBeenCalledWith('a1');
    });
    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['adventurers'] });
    });
  });

  it('surfaces a server error message when delete is rejected', async () => {
    const user = userEvent.setup();
    (api.adventurers.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ApiError('Elara is currently on a quest. Finish or cancel it before dismissing.', {
        status: 409,
      }),
    );
    renderRoster([makeAdv('a1', 'Elara')]);

    await user.click(screen.getByRole('button', { name: /dismiss elara/i }));
    await user.click(screen.getByRole('button', { name: /confirm dismiss elara/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/currently on a quest/i);
    });
  });
});
