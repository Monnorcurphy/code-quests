import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import QuestBoard from '../features/quests/quest-board';
import { api } from '../lib/api';
import type { Quest } from '@code-quests/shared';

vi.mock('../lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/api')>();
  return {
    ...original,
    api: {
      adventurers: { list: vi.fn().mockResolvedValue([]) },
      quests: {
        list: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
      },
      epics: { list: vi.fn().mockResolvedValue([]) },
    },
  };
});

const makeQuest = (overrides: Partial<Quest> = {}): Quest => ({
  id: 'q-1',
  epicId: null,
  title: 'Test Quest',
  description: '',
  acceptanceCriteria: [],
  edgeCases: [],
  context: '',
  status: 'idle',
  adventurerId: null,
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
});

function renderBoard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <QuestBoard />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('QuestBoard', () => {
  it('shows empty state when no quests exist', async () => {
    vi.mocked(api.quests.list).mockResolvedValue([]);
    renderBoard();

    await waitFor(() => {
      expect(
        screen.getByText('No quests yet — visit the War Room to draft one.'),
      ).toBeDefined();
    });
  });

  it('renders quest titles', async () => {
    vi.mocked(api.quests.list).mockResolvedValue([
      makeQuest({ id: 'q-1', title: 'Implement dark mode' }),
      makeQuest({ id: 'q-2', title: 'Fix login bug' }),
    ]);
    renderBoard();

    await waitFor(() => {
      expect(screen.getByText('Implement dark mode')).toBeDefined();
      expect(screen.getByText('Fix login bug')).toBeDefined();
    });
  });

  it('shows "Drafted" badge for idle quests', async () => {
    vi.mocked(api.quests.list).mockResolvedValue([makeQuest({ status: 'idle' })]);
    renderBoard();

    await waitFor(() => {
      expect(screen.getByText('Drafted')).toBeDefined();
    });
  });

  it('shows "Active" badge for active quests', async () => {
    vi.mocked(api.quests.list).mockResolvedValue([makeQuest({ status: 'active' })]);
    renderBoard();

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeDefined();
    });
  });

  it('shows AC count when acceptance criteria exist', async () => {
    vi.mocked(api.quests.list).mockResolvedValue([
      makeQuest({ acceptanceCriteria: ['AC one', 'AC two'] }),
    ]);
    renderBoard();

    await waitFor(() => {
      expect(screen.getByText('2 AC')).toBeDefined();
    });
  });

  it('shows error message when API fails', async () => {
    vi.mocked(api.quests.list).mockRejectedValue(new Error('Network error'));
    renderBoard();

    await waitFor(() => {
      expect(
        screen.getByText('Could not load quests. Make sure the server is running.'),
      ).toBeDefined();
    });
  });
});
