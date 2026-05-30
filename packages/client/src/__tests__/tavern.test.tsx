import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../lib/api';
import Tavern from '../features/tavern';
import { useTownStore } from '../stores/town-store';
import type { Quest } from '@code-quests/shared';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      quests: {
        ...actual.api.quests,
        get: vi.fn(),
        patch: vi.fn(),
        list: vi.fn().mockResolvedValue([]),
      },
    },
  };
});

function makeQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 'q-tavern',
    epicId: null,
    projectId: null,
    title: 'Test Quest',
    description: 'A test quest description',
    acceptanceCriteria: ['AC one'],
    edgeCases: ['Edge case one', 'Edge case two'],
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
  };
}

function renderTavern() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Tavern />
    </QueryClientProvider>,
  );
}

describe('Tavern', () => {
  beforeEach(() => {
    useTownStore.setState({ selectedQuestId: 'q-tavern' });
    vi.mocked(api.quests.get).mockReset();
    vi.mocked(api.quests.patch).mockReset();
  });

  afterEach(() => {
    useTownStore.setState({ selectedQuestId: null });
    vi.clearAllMocks();
  });

  it('shows a quest selector when selectedQuestId is null', async () => {
    useTownStore.setState({ selectedQuestId: null });
    renderTavern();
    await waitFor(() => {
      expect(screen.getByText(/no quests ready to prepare/i)).toBeDefined();
    });
  });

  it('renders edge case inputs when quest loads', async () => {
    vi.mocked(api.quests.get).mockResolvedValue(makeQuest());
    renderTavern();

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /edge case 1/i })).toBeDefined();
      expect(screen.getByRole('textbox', { name: /edge case 2/i })).toBeDefined();
    });
  });

  it('adds a new edge case when "+ Add Edge Case" is clicked', async () => {
    vi.mocked(api.quests.get).mockResolvedValue(makeQuest());
    const user = userEvent.setup();
    renderTavern();

    await waitFor(() => screen.getByRole('textbox', { name: /edge case 1/i }));
    await user.click(screen.getByRole('button', { name: /add edge case/i }));

    expect(screen.getByRole('textbox', { name: /edge case 3/i })).toBeDefined();
  });

  it('calls patch with updated edge cases on save', async () => {
    vi.mocked(api.quests.get).mockResolvedValue(makeQuest());
    vi.mocked(api.quests.patch).mockResolvedValue(makeQuest({ edgeCases: ['Updated case'] }));
    const user = userEvent.setup();
    renderTavern();

    await waitFor(() => screen.getByRole('textbox', { name: /edge case 1/i }));
    await user.clear(screen.getByRole('textbox', { name: /edge case 1/i }));
    await user.type(screen.getByRole('textbox', { name: /edge case 1/i }), 'Updated case');
    await user.click(screen.getByRole('button', { name: /save edge cases/i }));

    await waitFor(() => {
      expect(vi.mocked(api.quests.patch)).toHaveBeenCalledWith(
        'q-tavern',
        expect.objectContaining({ edgeCases: expect.any(Array) }),
      );
    });
  });

  it('shows success message after save', async () => {
    vi.mocked(api.quests.get).mockResolvedValue(makeQuest());
    vi.mocked(api.quests.patch).mockResolvedValue(makeQuest());
    const user = userEvent.setup();
    renderTavern();

    await waitFor(() => screen.getByRole('textbox', { name: /edge case 1/i }));
    await user.click(screen.getByRole('button', { name: /save edge cases/i }));

    await waitFor(() => {
      expect(screen.getByText(/edge cases saved/i)).toBeDefined();
    });
  });

  it('shows persistent error on save failure', async () => {
    vi.mocked(api.quests.get).mockResolvedValue(makeQuest());
    vi.mocked(api.quests.patch).mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    renderTavern();

    await waitFor(() => screen.getByRole('textbox', { name: /edge case 1/i }));
    await user.click(screen.getByRole('button', { name: /save edge cases/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
  });

  it('"Back to War Room" button sets modal to draft', async () => {
    const mockSetActiveModal = vi.fn();
    useTownStore.setState({ selectedQuestId: 'q-tavern', setActiveModal: mockSetActiveModal });
    vi.mocked(api.quests.get).mockResolvedValue(makeQuest());
    const user = userEvent.setup();
    renderTavern();

    await waitFor(() => screen.getByRole('button', { name: /back to war room/i }));
    await user.click(screen.getByRole('button', { name: /back to war room/i }));

    expect(mockSetActiveModal).toHaveBeenCalledWith('draft');
  });
});
