import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import HallOfReturns from '../features/hall-of-returns';
import { useTownStore } from '../stores/town-store';
import type { HallOfReturnsList } from '../lib/api';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

const { mockListQuests, mockSubscribe } = vi.hoisted(() => ({
  mockListQuests: vi.fn(),
  mockSubscribe: vi.fn(() => vi.fn()),
}));

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      hallOfReturns: {
        ...actual.api.hallOfReturns,
        listQuests: mockListQuests,
      },
    },
  };
});

vi.mock('../lib/quest-socket', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/quest-socket')>();
  return { ...actual, subscribe: mockSubscribe };
});

function makeItem(overrides: Partial<HallOfReturnsList['items'][number]> = {}): HallOfReturnsList['items'][number] {
  return {
    id: 'quest-1',
    epicId: null,
    projectId: null,
    title: 'Slay the Dragon',
    description: '',
    acceptanceCriteria: [],
    edgeCases: [],
    context: '',
    status: 'returned_to_town',
    adventurerId: 'adv-1',
    agentId: null,
    failureSummary: {
      recommendation: 'repost_with_clarification',
      reason: 'AC was unclear',
      notes: 'Ambiguous objectives.',
    },
    createdAt: '2024-01-01T10:00:00.000Z',
    updatedAt: '2024-01-01T10:30:00.000Z',
    adventurer: { id: 'adv-1', name: 'Aldric', class: 'champion' },
    equipment: { skillIds: [], toolIds: [], mcpServerIds: [] },
    fatalMonster: {
      monsterId: 'monster-1',
      monsterName: 'Shadow Drake',
      monsterTypeId: 'drake_shadow',
      spritePath: '/sprites/drake.png',
      difficulty: 3,
    },
    ...overrides,
  };
}

function makePage(items: HallOfReturnsList['items']): HallOfReturnsList {
  return { items, nextCursor: null, total: items.length };
}

function renderPanel(initialPath = '/town/hall-of-returns') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
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
    navigateMock.mockReset();
    mockListQuests.mockResolvedValue(makePage([]));
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

  it('renders tablist with Returned and Completed tabs', async () => {
    renderPanel();
    await screen.findByRole('dialog');
    expect(screen.getByRole('tab', { name: /returned/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /completed/i })).toBeDefined();
  });

  it('Returned tab is selected by default', async () => {
    renderPanel();
    await screen.findByRole('dialog');
    const returnedTab = screen.getByRole('tab', { name: /returned/i });
    expect(returnedTab.getAttribute('aria-selected')).toBe('true');
    const completedTab = screen.getByRole('tab', { name: /completed/i });
    expect(completedTab.getAttribute('aria-selected')).toBe('false');
  });

  it('shows loading state while fetching', () => {
    mockListQuests.mockImplementation(() => new Promise(() => {}));
    renderPanel();
    const list = document.querySelector('[aria-busy="true"]');
    expect(list).not.toBeNull();
  });

  it('shows error state when fetch fails', async () => {
    mockListQuests.mockRejectedValue(new Error('network error'));
    renderPanel();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/could not load/i);
    expect(screen.getByRole('button', { name: /retry/i })).toBeDefined();
  });

  it('shows empty state when no quests have returned', async () => {
    renderPanel();
    await screen.findByText(/no returned quests yet — the guild has been victorious/i);
  });

  it('renders quest rows when data exists', async () => {
    mockListQuests.mockResolvedValue(makePage([makeItem()]));
    renderPanel();
    await screen.findByText('Slay the Dragon');
    expect(screen.getByText('Aldric')).toBeDefined();
    expect(screen.getByText('champion')).toBeDefined();
  });

  it('clicking a row navigates to /hall-of-returns/:questId', async () => {
    const user = userEvent.setup();
    mockListQuests.mockResolvedValue(makePage([makeItem()]));
    renderPanel();
    const row = await screen.findByRole('button', { name: /slay the dragon — view post-mortem/i });
    await user.click(row);
    expect(navigateMock).toHaveBeenCalledWith('/hall-of-returns/quest-1');
  });

  it('clicking the Completed tab switches aria-selected', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByRole('dialog');
    const completedTab = screen.getByRole('tab', { name: /completed/i });
    await user.click(completedTab);
    expect(completedTab.getAttribute('aria-selected')).toBe('true');
    const returnedTab = screen.getByRole('tab', { name: /returned/i });
    expect(returnedTab.getAttribute('aria-selected')).toBe('false');
  });

  it('close button sets activeModal to null in the store', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByRole('dialog');
    const closeBtn = screen.getByRole('button', { name: /close hall of returns/i });
    await user.click(closeBtn);
    expect(useTownStore.getState().activeModal).toBeNull();
  });

  it('tabpanels exist in DOM for screen readers', async () => {
    renderPanel();
    await screen.findByRole('dialog');
    expect(document.getElementById('hall-panel-returned')).not.toBeNull();
    expect(document.getElementById('hall-panel-completed')).not.toBeNull();
  });

  it('tab state preserved via URL search param when tab=complete', async () => {
    mockListQuests.mockResolvedValue(makePage([]));
    renderPanel('/town/hall-of-returns?tab=complete');
    await screen.findByRole('dialog');
    const completedTab = screen.getByRole('tab', { name: /completed/i });
    expect(completedTab.getAttribute('aria-selected')).toBe('true');
  });
});
