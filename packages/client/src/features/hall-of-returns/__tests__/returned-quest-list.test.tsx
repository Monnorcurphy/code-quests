import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import ReturnedQuestList from '../returned-quest-list';
import type { HallOfReturnsList } from '../../../lib/api';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

const { mockListQuests, mockSubscribe } = vi.hoisted(() => ({
  mockListQuests: vi.fn(),
  mockSubscribe: vi.fn(() => vi.fn()),
}));

vi.mock('../../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api')>();
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

vi.mock('../../../lib/quest-socket', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/quest-socket')>();
  return { ...actual, subscribe: mockSubscribe };
});

function makeItem(overrides: Partial<HallOfReturnsList['items'][number]> = {}): HallOfReturnsList['items'][number] {
  return {
    id: 'quest-1',
    epicId: null,
    projectId: null,
    modelId: null,
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
      notes: 'The quest had ambiguous objectives.',
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

function renderList(status: 'returned_to_town' | 'complete' = 'returned_to_town') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ReturnedQuestList status={status} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('ReturnedQuestList', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    mockListQuests.mockResolvedValue(makePage([]));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows three skeleton rows while loading', () => {
    mockListQuests.mockImplementation(() => new Promise(() => {}));
    renderList();
    const list = screen.getByRole('list', { name: /loading quests/i });
    expect(list.getAttribute('aria-busy')).toBe('true');
    expect(list.querySelectorAll('.hall-list-row--skeleton').length).toBe(3);
  });

  it('shows error banner with retry button when fetch fails', async () => {
    mockListQuests.mockRejectedValue(new Error('network error'));
    renderList();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/could not load/i);
    expect(screen.getByRole('button', { name: /retry/i })).toBeDefined();
  });

  it('shows empty state when no quests have returned', async () => {
    renderList();
    await screen.findByText(/no returned quests yet — the guild has been victorious/i);
  });

  it('renders quest rows with title, adventurer, monster, recommendation', async () => {
    mockListQuests.mockResolvedValue(makePage([makeItem()]));
    renderList();
    await screen.findByText('Slay the Dragon');
    expect(screen.getByText('Aldric')).toBeDefined();
    expect(screen.getByText('champion')).toBeDefined();
    expect(screen.getByText('Shadow Drake')).toBeDefined();
    expect(screen.getByText('Repost')).toBeDefined();
  });

  it('row has accessible name including quest title', async () => {
    mockListQuests.mockResolvedValue(makePage([makeItem()]));
    renderList();
    await screen.findByRole('button', { name: /slay the dragon — view post-mortem/i });
  });

  it('clicking a row navigates to /hall-of-returns/:questId', async () => {
    const user = userEvent.setup();
    mockListQuests.mockResolvedValue(makePage([makeItem()]));
    renderList();
    const row = await screen.findByRole('button', { name: /slay the dragon/i });
    await user.click(row);
    expect(navigateMock).toHaveBeenCalledWith('/hall-of-returns/quest-1');
  });

  it('pressing Enter on a row navigates to /hall-of-returns/:questId', async () => {
    const user = userEvent.setup();
    mockListQuests.mockResolvedValue(makePage([makeItem()]));
    renderList();
    const row = await screen.findByRole('button', { name: /slay the dragon/i });
    row.focus();
    await user.keyboard('{Enter}');
    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/hall-of-returns/quest-1');
  });

  it('renders a row with no adventurer gracefully', async () => {
    mockListQuests.mockResolvedValue(makePage([makeItem({ adventurer: null })]));
    renderList();
    await screen.findByText('Slay the Dragon');
    expect(screen.getByText(/no adventurer/i)).toBeDefined();
  });

  it('renders a row with no fatal monster gracefully', async () => {
    mockListQuests.mockResolvedValue(makePage([makeItem({ fatalMonster: null })]));
    renderList();
    await screen.findByText('Slay the Dragon');
    expect(screen.queryByText('Shadow Drake')).toBeNull();
  });

  it('renders a row with no failure summary without recommendation badge', async () => {
    mockListQuests.mockResolvedValue(makePage([makeItem({ failureSummary: null, status: 'complete' })]));
    renderList('complete');
    await screen.findByText('Slay the Dragon');
    expect(screen.queryByText('Repost')).toBeNull();
  });

  it('shows relative time for each row', async () => {
    mockListQuests.mockResolvedValue(makePage([makeItem()]));
    renderList();
    await screen.findByText('Slay the Dragon');
    const timeEl = document.querySelector('time');
    expect(timeEl).not.toBeNull();
  });

  it('renders multiple rows', async () => {
    mockListQuests.mockResolvedValue(
      makePage([
        makeItem({ id: 'q1', title: 'Quest Alpha' }),
        makeItem({ id: 'q2', title: 'Quest Beta' }),
      ]),
    );
    renderList();
    await screen.findByText('Quest Alpha');
    expect(screen.getByText('Quest Beta')).toBeDefined();
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });
});
