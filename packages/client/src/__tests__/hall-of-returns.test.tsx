import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import HallOfReturns from '../features/hall-of-returns';
import { useTownStore } from '../stores/town-store';
import type { ReturnedQuest, ReturnedQuestsPage } from '../lib/api';

const { mockReturnedQuests } = vi.hoisted(() => ({
  mockReturnedQuests: vi.fn(),
}));

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      quests: {
        ...actual.api.quests,
        returned: mockReturnedQuests,
      },
    },
  };
});

function makeCompleteQuest(overrides: Partial<ReturnedQuest> = {}): ReturnedQuest {
  return {
    id: 'q-complete',
    epicId: null,
    title: 'Slay the Dragon',
    description: '',
    acceptanceCriteria: [],
    edgeCases: [],
    context: '',
    status: 'complete',
    adventurerId: 'adv-1',
    agentId: 'ag-1',
    failureSummary: null,
    createdAt: '2024-01-01T10:00:00.000Z',
    updatedAt: '2024-01-01T11:00:00.000Z',
    adventurer: { id: 'adv-1', name: 'Aldric', class: 'champion' },
    agent: {
      id: 'ag-1',
      startedAt: '2024-01-01T10:00:00.000Z',
      endedAt: '2024-01-01T10:30:00.000Z',
      events: [
        { type: 'progress', timestamp: '2024-01-01T10:01:00.000Z', message: 'Entered the cave' },
        { type: 'combat', timestamp: '2024-01-01T10:10:00.000Z', message: 'Battle joined' },
        { type: 'completed', timestamp: '2024-01-01T10:30:00.000Z' },
      ],
    },
    ...overrides,
  };
}

function makeFailedQuest(overrides: Partial<ReturnedQuest> = {}): ReturnedQuest {
  return {
    id: 'q-failed',
    epicId: null,
    title: 'Retrieve the Artifact',
    description: '',
    acceptanceCriteria: [],
    edgeCases: [],
    context: '',
    status: 'failed',
    adventurerId: 'adv-2',
    agentId: 'ag-2',
    failureSummary: {
      reason: 'The artifact was trapped',
      recommendation: 'repost_with_clarification',
    },
    createdAt: '2024-01-02T10:00:00.000Z',
    updatedAt: '2024-01-02T10:45:00.000Z',
    adventurer: { id: 'adv-2', name: 'Mira', class: 'rogue' },
    agent: {
      id: 'ag-2',
      startedAt: '2024-01-02T10:00:00.000Z',
      endedAt: '2024-01-02T10:45:00.000Z',
      events: [
        { type: 'progress', timestamp: '2024-01-02T10:05:00.000Z', message: 'Found the vault' },
        { type: 'failed', timestamp: '2024-01-02T10:45:00.000Z', reason: 'Trapped' },
      ],
    },
    ...overrides,
  };
}

function makePage(items: ReturnedQuest[]): ReturnedQuestsPage {
  return { items, total: items.length, limit: 20, offset: 0 };
}

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={['/town/hall-of-returns']}>
      <Routes>
        <Route
          path="/town/:sceneKey"
          element={
            <QueryClientProvider client={queryClient}>
              <HallOfReturns />
            </QueryClientProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('HallOfReturns', () => {
  beforeEach(() => {
    useTownStore.setState({ activeModal: 'hall-of-returns' });
    mockReturnedQuests.mockResolvedValue(makePage([]));
  });

  afterEach(() => {
    useTownStore.setState({ activeModal: null });
    vi.clearAllMocks();
  });

  it('renders as a dialog with accessible label', async () => {
    renderPanel();
    const dialog = await screen.findByRole('dialog');
    expect(dialog.getAttribute('aria-labelledby')).toBe('hall-of-returns-title');
    expect(screen.getByText('Hall of Returns')).toBeDefined();
  });

  it('shows loading state while fetching', () => {
    mockReturnedQuests.mockImplementation(() => new Promise(() => {}));
    renderPanel();
    expect(screen.getByText(/loading returned quests/i)).toBeDefined();
  });

  it('shows error state when fetch fails', async () => {
    mockReturnedQuests.mockRejectedValue(new Error('network error'));
    renderPanel();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/could not load/i);
  });

  it('shows empty state when no quests have returned', async () => {
    renderPanel();
    await screen.findByText(/no quests have returned yet/i);
  });

  it('shows both columns when quests exist', async () => {
    mockReturnedQuests.mockResolvedValue(
      makePage([makeCompleteQuest(), makeFailedQuest()]),
    );
    renderPanel();
    await screen.findByText('Victorious');
    expect(screen.getByText('Returned in Defeat')).toBeDefined();
  });

  it('renders complete quest card with adventurer name and class', async () => {
    mockReturnedQuests.mockResolvedValue(makePage([makeCompleteQuest()]));
    renderPanel();
    await screen.findByText('Slay the Dragon');
    expect(screen.getByText('Aldric')).toBeDefined();
    expect(screen.getByText('champion')).toBeDefined();
  });

  it('renders failed quest card with failure recommendation', async () => {
    mockReturnedQuests.mockResolvedValue(makePage([makeFailedQuest()]));
    renderPanel();
    await screen.findByText('Retrieve the Artifact');
    expect(screen.getByText('Mira')).toBeDefined();
    expect(screen.getByText(/repost with clarification/i)).toBeDefined();
  });

  it('renders last log lines in the card', async () => {
    mockReturnedQuests.mockResolvedValue(makePage([makeCompleteQuest()]));
    renderPanel();
    await screen.findByText('Entered the cave');
    expect(screen.getByText(/battle joined/i)).toBeDefined();
  });

  it('clicking a card opens the detail view', async () => {
    const user = userEvent.setup();
    mockReturnedQuests.mockResolvedValue(makePage([makeCompleteQuest()]));
    renderPanel();
    const btn = await screen.findByRole('button', { name: /view details for slay the dragon/i });
    await user.click(btn);
    expect(screen.getByRole('list', { name: /quest event log/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /back to hall of returns/i })).toBeDefined();
  });

  it('back button in detail view returns to list', async () => {
    const user = userEvent.setup();
    mockReturnedQuests.mockResolvedValue(makePage([makeCompleteQuest()]));
    renderPanel();
    const card = await screen.findByRole('button', { name: /view details for slay the dragon/i });
    await user.click(card);
    const backBtn = screen.getByRole('button', { name: /back to hall of returns/i });
    await user.click(backBtn);
    await screen.findByText('Victorious');
  });

  it('detail view shows failure summary for failed quests', async () => {
    const user = userEvent.setup();
    mockReturnedQuests.mockResolvedValue(makePage([makeFailedQuest()]));
    renderPanel();
    const card = await screen.findByRole('button', { name: /view details for retrieve the artifact/i });
    await user.click(card);
    expect(screen.getByText(/the artifact was trapped/i)).toBeDefined();
    expect(screen.getByText(/repost with clarification/i)).toBeDefined();
  });

  it('detail view shows Phase 9 coming-soon note — no Re-post or Retire buttons', async () => {
    const user = userEvent.setup();
    mockReturnedQuests.mockResolvedValue(makePage([makeCompleteQuest()]));
    renderPanel();
    const card = await screen.findByRole('button', { name: /view details for slay the dragon/i });
    await user.click(card);
    expect(screen.getByText(/coming in phase 9/i)).toBeDefined();
    const buttons = screen.getAllByRole('button');
    const hasNoOpButton = buttons.some((b) => /re-post|retire/i.test(b.textContent ?? ''));
    expect(hasNoOpButton).toBe(false);
  });

  it('detail view shows full combat log in a list', async () => {
    const user = userEvent.setup();
    mockReturnedQuests.mockResolvedValue(makePage([makeCompleteQuest()]));
    renderPanel();
    const card = await screen.findByRole('button', { name: /view details for slay the dragon/i });
    await user.click(card);
    const logList = screen.getByRole('list', { name: /quest event log/i });
    expect(logList.querySelectorAll('li').length).toBe(3);
  });

  it('detail view shows empty log message when quest has no events', async () => {
    const user = userEvent.setup();
    mockReturnedQuests.mockResolvedValue(
      makePage([
        makeCompleteQuest({
          agent: {
            id: 'ag-1',
            startedAt: '2024-01-01T10:00:00.000Z',
            endedAt: '2024-01-01T11:00:00.000Z',
            events: [],
          },
        }),
      ]),
    );
    renderPanel();
    const card = await screen.findByRole('button', { name: /view details for slay the dragon/i });
    await user.click(card);
    expect(screen.getByText(/no events recorded/i)).toBeDefined();
  });

  it('handles quest with no agent gracefully', async () => {
    const user = userEvent.setup();
    mockReturnedQuests.mockResolvedValue(
      makePage([makeCompleteQuest({ agent: null, adventurer: null })]),
    );
    renderPanel();
    const card = await screen.findByRole('button', { name: /view details for slay the dragon/i });
    await user.click(card);
    expect(screen.getByText(/no events recorded/i)).toBeDefined();
  });

  it('close button sets activeModal to null in the store', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByRole('dialog');
    const closeBtn = screen.getByRole('button', { name: /close hall of returns/i });
    await user.click(closeBtn);
    expect(useTownStore.getState().activeModal).toBeNull();
  });

  it('outcome uses both text and a CSS class — not color alone', async () => {
    mockReturnedQuests.mockResolvedValue(makePage([makeCompleteQuest(), makeFailedQuest()]));
    renderPanel();
    await screen.findByText('Slay the Dragon');
    const victoryBadge = screen.getByText('Victory');
    const defeatBadge = screen.getByText('Defeat');
    expect(victoryBadge.className).toContain('quest-badge--complete');
    expect(defeatBadge.className).toContain('quest-badge--failed');
  });

  it('reduced-motion: card uses data attribute class for transition suppression', async () => {
    document.documentElement.setAttribute('data-reduced-motion', 'true');
    mockReturnedQuests.mockResolvedValue(makePage([makeCompleteQuest()]));
    renderPanel();
    await screen.findByText('Slay the Dragon');
    const card = screen.getByRole('button', { name: /view details/i });
    expect(card.classList.contains('return-card')).toBe(true);
    document.documentElement.removeAttribute('data-reduced-motion');
  });
});
