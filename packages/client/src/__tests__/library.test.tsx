import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../lib/api';
import Library from '../features/library';
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
      },
    },
  };
});

function makeQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 'q-library',
    epicId: null,
    title: 'Test Quest',
    description: 'A test quest description',
    acceptanceCriteria: ['AC one'],
    edgeCases: [],
    context: 'Some existing context',
    status: 'idle',
    adventurerId: null,
    agentId: null,
    equipment: { skillIds: [], toolIds: [], mcpServerIds: [] },
    specAudit: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderLibrary() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Library />
    </QueryClientProvider>,
  );
}

describe('Library', () => {
  beforeEach(() => {
    useTownStore.setState({ selectedQuestId: 'q-library' });
    vi.mocked(api.quests.get).mockReset();
    vi.mocked(api.quests.patch).mockReset();
  });

  afterEach(() => {
    useTownStore.setState({ selectedQuestId: null });
    vi.clearAllMocks();
  });

  it('shows "no quest selected" message when selectedQuestId is null', () => {
    useTownStore.setState({ selectedQuestId: null });
    renderLibrary();
    expect(screen.getByText(/no quest selected/i)).toBeDefined();
  });

  it('renders loading state while fetching', async () => {
    vi.mocked(api.quests.get).mockImplementation(() => new Promise(() => {}));
    renderLibrary();
    await waitFor(() => {
      expect(screen.getByText(/loading quest/i)).toBeDefined();
    });
  });

  it('pre-populates textarea with existing context', async () => {
    vi.mocked(api.quests.get).mockResolvedValue(makeQuest());
    renderLibrary();

    await waitFor(() => {
      const textarea = screen.getByRole('textbox', { name: /quest context/i }) as HTMLTextAreaElement;
      expect(textarea.value).toBe('Some existing context');
    });
  });

  it('calls patch with updated context on save', async () => {
    vi.mocked(api.quests.get).mockResolvedValue(makeQuest());
    vi.mocked(api.quests.patch).mockResolvedValue(makeQuest({ context: 'Updated context text' }));
    const user = userEvent.setup();
    renderLibrary();

    await waitFor(() => screen.getByRole('textbox', { name: /quest context/i }));
    const textarea = screen.getByRole('textbox', { name: /quest context/i });
    await user.clear(textarea);
    await user.type(textarea, 'Updated context text');
    await user.click(screen.getByRole('button', { name: /save context/i }));

    await waitFor(() => {
      expect(vi.mocked(api.quests.patch)).toHaveBeenCalledWith(
        'q-library',
        expect.objectContaining({ context: 'Updated context text' }),
      );
    });
  });

  it('shows success message after save', async () => {
    vi.mocked(api.quests.get).mockResolvedValue(makeQuest());
    vi.mocked(api.quests.patch).mockResolvedValue(makeQuest());
    const user = userEvent.setup();
    renderLibrary();

    await waitFor(() => screen.getByRole('button', { name: /save context/i }));
    await user.click(screen.getByRole('button', { name: /save context/i }));

    await waitFor(() => {
      expect(screen.getByText(/context saved/i)).toBeDefined();
    });
  });

  it('shows persistent error on save failure', async () => {
    vi.mocked(api.quests.get).mockResolvedValue(makeQuest());
    vi.mocked(api.quests.patch).mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    renderLibrary();

    await waitFor(() => screen.getByRole('button', { name: /save context/i }));
    await user.click(screen.getByRole('button', { name: /save context/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
  });

  it('"Back to War Room" button sets modal to draft', async () => {
    const mockSetActiveModal = vi.fn();
    useTownStore.setState({ selectedQuestId: 'q-library', setActiveModal: mockSetActiveModal });
    vi.mocked(api.quests.get).mockResolvedValue(makeQuest());
    const user = userEvent.setup();
    renderLibrary();

    await waitFor(() => screen.getByRole('button', { name: /back to war room/i }));
    await user.click(screen.getByRole('button', { name: /back to war room/i }));

    expect(mockSetActiveModal).toHaveBeenCalledWith('draft');
  });
});
