import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PostMortem from '../post-mortem';
import type { PostMortemResponse } from '../../../lib/api';
import type { MonsterEncounter } from '@code-quests/shared';

const navigateMock = vi.fn();
const setActiveModalMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../../../stores/town-store', () => ({
  useTownStore: (selector: (s: { setActiveModal: typeof setActiveModalMock }) => unknown) =>
    selector({ setActiveModal: setActiveModalMock }),
}));

vi.mock('../../../lib/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}));

const { mockGetPostMortem, mockSubmitFeedback, mockSubscribe } = vi.hoisted(() => ({
  mockGetPostMortem: vi.fn(),
  mockSubmitFeedback: vi.fn(),
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
        getPostMortem: mockGetPostMortem,
      },
      quests: {
        ...actual.api.quests,
        submitFeedback: mockSubmitFeedback,
      },
    },
  };
});

vi.mock('../../../lib/quest-socket', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/quest-socket')>();
  return { ...actual, subscribe: mockSubscribe };
});

function makeEncounter(overrides: Partial<MonsterEncounter> = {}): MonsterEncounter {
  return {
    id: 'enc-1',
    monsterId: 'monster-1',
    questId: 'quest-1',
    appearedAt: '2024-01-01T10:00:00.000Z',
    combatLog: ['The dragon breathes fire!', 'You dodge narrowly.'],
    outcome: 'defeat',
    loot: [],
    resolvedAt: '2024-01-01T10:05:00.000Z',
    monsterName: 'Shadow Drake',
    spritePath: '/sprites/drake.png',
    difficulty: 3,
    ...overrides,
  };
}

function makePostMortem(overrides: Partial<PostMortemResponse> = {}): PostMortemResponse {
  return {
    quest: {
      id: 'quest-1',
      epicId: null,
      title: 'Slay the Dragon',
      description: 'A dangerous quest.',
      acceptanceCriteria: ['Dragon defeated'],
      edgeCases: [],
      context: '',
      status: 'returned_to_town',
      adventurerId: 'adv-1',
      agentId: null,
      failureSummary: {
        recommendation: 'repost_with_clarification',
        reason: 'AC was unclear',
        notes: 'The acceptance criteria were too vague.',
        retries: 1,
      },
      createdAt: '2024-01-01T09:00:00.000Z',
      updatedAt: '2024-01-01T10:30:00.000Z',
      adventurer: { id: 'adv-1', name: 'Aldric', class: 'champion' },
      fatalMonster: {
        monsterId: 'monster-1',
        monsterName: 'Shadow Drake',
        spritePath: '/sprites/drake.png',
        difficulty: 3,
      },
    },
    attempts: [
      {
        id: 'attempt-1',
        startedAt: '2024-01-01T10:00:00.000Z',
        endedAt: '2024-01-01T10:30:00.000Z',
        events: [],
      },
    ],
    encounters: [makeEncounter()],
    failureSummary: {
      recommendation: 'repost_with_clarification',
      reason: 'AC was unclear',
      notes: 'The acceptance criteria were too vague.',
      retries: 1,
    },
    adventurer: { id: 'adv-1', name: 'Aldric', class: 'champion' },
    ...overrides,
  };
}

function renderPostMortem(questId = 'quest-1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={[`/hall-of-returns/${questId}`]}>
      <Routes>
        <Route
          path="/hall-of-returns/:questId"
          element={
            <QueryClientProvider client={queryClient}>
              <PostMortem />
            </QueryClientProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PostMortem', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    setActiveModalMock.mockReset();
    mockGetPostMortem.mockResolvedValue(makePostMortem());
    mockSubmitFeedback.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while fetching', () => {
    mockGetPostMortem.mockImplementation(() => new Promise(() => {}));
    renderPostMortem();
    const main = document.querySelector('[aria-busy="true"]');
    expect(main).not.toBeNull();
    expect(screen.getByText(/loading post-mortem/i)).toBeDefined();
  });

  it('renders quest title and status once loaded', async () => {
    renderPostMortem();
    await screen.findByText('Slay the Dragon');
    expect(screen.getByRole('heading', { name: 'Slay the Dragon' })).toBeDefined();
  });

  it('renders adventurer name and class', async () => {
    renderPostMortem();
    await screen.findByText('Slay the Dragon');
    expect(screen.getByText('Aldric')).toBeDefined();
    expect(screen.getByText('champion')).toBeDefined();
  });

  it('renders failure summary section', async () => {
    renderPostMortem();
    await screen.findByText('Failure Summary');
    expect(screen.getByText(/the acceptance criteria were too vague/i)).toBeDefined();
    expect(screen.getByText(/repost with clarification/i)).toBeDefined();
  });

  it('renders combat log section', async () => {
    renderPostMortem();
    await screen.findByText('Combat Log');
    expect(
      screen.getByRole('list', { name: /monster encounters/i }),
    ).toBeDefined();
  });

  it('renders feedback form section', async () => {
    renderPostMortem();
    await screen.findByText('Leave Feedback');
    expect(screen.getByLabelText(/your feedback/i)).toBeDefined();
  });

  it('shows 404 error state when quest not found', async () => {
    const { ApiError } = await import('../../../lib/api');
    mockGetPostMortem.mockRejectedValue(new ApiError('Not found', { status: 404 }));
    renderPostMortem();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/quest not found/i);
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
  });

  it('shows server error state with retry button on 500', async () => {
    const { ApiError } = await import('../../../lib/api');
    mockGetPostMortem.mockRejectedValue(new ApiError('Server error', { status: 500 }));
    renderPostMortem();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/could not load/i);
    expect(screen.getByRole('button', { name: /retry/i })).toBeDefined();
  });

  it('back button navigates to hall-of-returns town scene', async () => {
    const user = (await import('@testing-library/user-event')).default;
    const setup = user.setup();
    renderPostMortem();
    const backBtn = await screen.findByRole('button', { name: /back to hall of returns/i });
    await setup.click(backBtn);
    expect(setActiveModalMock).toHaveBeenCalledWith('hall-of-returns');
    expect(navigateMock).toHaveBeenCalledWith('/town/hall-of-returns');
  });

  it('renders with no failure summary gracefully', async () => {
    mockGetPostMortem.mockResolvedValue(
      makePostMortem({
        failureSummary: null,
        quest: {
          ...makePostMortem().quest,
          failureSummary: null,
        },
      }),
    );
    renderPostMortem();
    await screen.findByText('Slay the Dragon');
    expect(screen.queryByText('Failure Summary')).toBeNull();
  });

  it('renders with no encounters gracefully', async () => {
    mockGetPostMortem.mockResolvedValue(makePostMortem({ encounters: [] }));
    renderPostMortem();
    await screen.findByText('Combat Log');
    expect(screen.getByText(/no encounters recorded/i)).toBeDefined();
  });

  it('renders with no adventurer gracefully', async () => {
    mockGetPostMortem.mockResolvedValue(
      makePostMortem({ adventurer: null }),
    );
    renderPostMortem();
    await screen.findByText('Slay the Dragon');
    expect(screen.queryByText('Aldric')).toBeNull();
  });

  it('moves focus to back button after data loads', async () => {
    let resolvePostMortem!: (v: ReturnType<typeof makePostMortem>) => void;
    mockGetPostMortem.mockReturnValue(
      new Promise<ReturnType<typeof makePostMortem>>((resolve) => {
        resolvePostMortem = resolve;
      }),
    );
    renderPostMortem();
    // While loading, the back button is not in the DOM — focus must not have moved yet
    expect(screen.queryByRole('button', { name: /back to hall of returns/i })).toBeNull();
    // Resolve data — back button mounts
    resolvePostMortem(makePostMortem());
    const backBtn = await screen.findByRole('button', { name: /back to hall of returns/i });
    expect(document.activeElement).toBe(backBtn);
  });
});
