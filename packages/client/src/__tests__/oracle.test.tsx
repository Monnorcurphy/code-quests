import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../lib/api';
import Oracle from '../features/oracle';
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
    id: 'q-oracle',
    epicId: null,
    title: 'Test Quest',
    description: 'A test quest description',
    acceptanceCriteria: ['AC one', 'AC two'],
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
  };
}

function renderOracle() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Oracle />
    </QueryClientProvider>,
  );
}

describe('Oracle', () => {
  beforeEach(() => {
    useTownStore.setState({ selectedQuestId: 'q-oracle' });
    vi.mocked(api.quests.get).mockReset();
    vi.mocked(api.quests.patch).mockReset();
  });

  afterEach(() => {
    useTownStore.setState({ selectedQuestId: null });
    vi.clearAllMocks();
  });

  it('shows "no quest selected" message when selectedQuestId is null', () => {
    useTownStore.setState({ selectedQuestId: null });
    renderOracle();
    expect(screen.getByText(/no quest selected/i)).toBeDefined();
  });

  it('shows loading state while fetching quest', async () => {
    vi.mocked(api.quests.get).mockImplementation(() => new Promise(() => {}));
    renderOracle();
    await waitFor(() => {
      expect(screen.getByText(/loading quest/i)).toBeDefined();
    });
  });

  it('renders acceptance criteria inputs when quest loads', async () => {
    vi.mocked(api.quests.get).mockResolvedValue(makeQuest());
    renderOracle();

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /criterion 1/i })).toBeDefined();
      expect(screen.getByRole('textbox', { name: /criterion 2/i })).toBeDefined();
    });
  });

  it('shows locked state when quest is not idle', async () => {
    vi.mocked(api.quests.get).mockResolvedValue(makeQuest({ status: 'active' }));
    renderOracle();

    await waitFor(() => {
      expect(screen.getByText(/acceptance criteria are locked/i)).toBeDefined();
    });
    expect(screen.queryByRole('button', { name: /save criteria/i })).toBeNull();
  });

  it('adds a new criterion when "+ Add Criterion" is clicked', async () => {
    vi.mocked(api.quests.get).mockResolvedValue(makeQuest());
    const user = userEvent.setup();
    renderOracle();

    await waitFor(() => screen.getByRole('textbox', { name: /criterion 1/i }));
    await user.click(screen.getByRole('button', { name: /add criterion/i }));

    expect(screen.getByRole('textbox', { name: /criterion 3/i })).toBeDefined();
  });

  it('removes a criterion when × is clicked', async () => {
    vi.mocked(api.quests.get).mockResolvedValue(makeQuest());
    const user = userEvent.setup();
    renderOracle();

    await waitFor(() => screen.getByRole('textbox', { name: /criterion 2/i }));
    await user.click(screen.getByRole('button', { name: /remove criterion 2/i }));

    expect(screen.queryByLabelText(/criterion 2/i)).toBeNull();
  });

  it('calls patch with updated criteria on save', async () => {
    vi.mocked(api.quests.get).mockResolvedValue(makeQuest());
    vi.mocked(api.quests.patch).mockResolvedValue(makeQuest({ acceptanceCriteria: ['Updated AC'] }));
    const user = userEvent.setup();
    renderOracle();

    await waitFor(() => screen.getByRole('textbox', { name: /criterion 1/i }));

    await user.clear(screen.getByRole('textbox', { name: /criterion 1/i }));
    await user.type(screen.getByRole('textbox', { name: /criterion 1/i }), 'Updated AC');
    await user.click(screen.getByRole('button', { name: /save criteria/i }));

    await waitFor(() => {
      expect(vi.mocked(api.quests.patch)).toHaveBeenCalledWith(
        'q-oracle',
        expect.objectContaining({ acceptanceCriteria: expect.any(Array) }),
      );
    });
  });

  it('shows success message after save', async () => {
    vi.mocked(api.quests.get).mockResolvedValue(makeQuest());
    vi.mocked(api.quests.patch).mockResolvedValue(makeQuest());
    const user = userEvent.setup();
    renderOracle();

    await waitFor(() => screen.getByRole('textbox', { name: /criterion 1/i }));
    await user.click(screen.getByRole('button', { name: /save criteria/i }));

    await waitFor(() => {
      expect(screen.getByText(/criteria saved/i)).toBeDefined();
    });
  });

  it('shows persistent error on save failure', async () => {
    vi.mocked(api.quests.get).mockResolvedValue(makeQuest());
    vi.mocked(api.quests.patch).mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    renderOracle();

    await waitFor(() => screen.getByRole('textbox', { name: /criterion 1/i }));
    await user.click(screen.getByRole('button', { name: /save criteria/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
  });

  it('"Back to War Room" button sets modal to draft', async () => {
    const mockSetActiveModal = vi.fn();
    useTownStore.setState({ selectedQuestId: 'q-oracle', setActiveModal: mockSetActiveModal });
    vi.mocked(api.quests.get).mockResolvedValue(makeQuest());
    const user = userEvent.setup();
    renderOracle();

    await waitFor(() => screen.getByRole('button', { name: /back to war room/i }));
    await user.click(screen.getByRole('button', { name: /back to war room/i }));

    expect(mockSetActiveModal).toHaveBeenCalledWith('draft');
  });
});
