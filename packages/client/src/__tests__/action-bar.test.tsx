import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ActionBar from '../features/hall-of-returns/actions/action-bar';
import { useTownStore } from '../stores/town-store';
import type { HallOfReturnsQuest } from '../lib/api';

const { mockRepost } = vi.hoisted(() => ({
  mockRepost: vi.fn(),
}));

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      quests: {
        ...actual.api.quests,
        repost: mockRepost,
      },
    },
  };
});

function makeQuest(overrides: Partial<HallOfReturnsQuest> = {}): HallOfReturnsQuest {
  return {
    id: 'q-1',
    epicId: null,
    title: 'Slay the Dragon',
    description: 'A big dragon',
    acceptanceCriteria: ['AC 1'],
    edgeCases: [],
    context: '',
    status: 'returned_to_town',
    adventurerId: null,
    agentId: null,
    failureSummary: {
      recommendation: 'repost_with_clarification',
      reason: 'AC unclear',
    },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    adventurer: null,
    fatalMonster: null,
    ...overrides,
  };
}

function renderBar(quest = makeQuest()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ActionBar questId="q-1" quest={quest} recommendation="repost_with_clarification" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function triggerSuccessfulRepost(user: ReturnType<typeof userEvent.setup>) {
  // Open the repost dialog (action bar button includes "Recommended" in text, dialog submit does not)
  const actionBtns = screen.getAllByRole('button', { name: /re-post quest/i });
  await user.click(actionBtns[0]);

  const dialog = screen.getByRole('dialog');
  const submitBtn = within(dialog).getByRole('button', { name: /re-post quest/i });
  await user.click(submitBtn);
}

describe('ActionBar — repost linkage navigation', () => {
  beforeEach(() => {
    mockRepost.mockReset();
    useTownStore.setState({ selectedQuestId: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a War Room Link (not raw anchor) after successful repost', async () => {
    const user = userEvent.setup();
    mockRepost.mockResolvedValue({ newQuestId: 'new-q-1', newTitle: 'Dragon Quest v2' });

    renderBar();
    await triggerSuccessfulRepost(user);

    const link = await screen.findByRole('link', { name: /dragon quest v2/i });
    expect(link.getAttribute('href')).toBe('/town/war-room');
  });

  it('sets selectedQuestId on the town store when the repost linkage is clicked', async () => {
    const user = userEvent.setup();
    mockRepost.mockResolvedValue({ newQuestId: 'new-q-1', newTitle: 'Dragon Quest v2' });

    renderBar();
    await triggerSuccessfulRepost(user);

    const link = await screen.findByRole('link', { name: /dragon quest v2/i });
    await user.click(link);

    expect(useTownStore.getState().selectedQuestId).toBe('new-q-1');
  });
});

describe('ActionBar — toast timer cleanup', () => {
  beforeEach(() => {
    mockRepost.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls clearTimeout on unmount when a toast timer is pending', async () => {
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    mockRepost.mockResolvedValue({ newQuestId: 'new-q-1', newTitle: 'Dragon Quest v2' });

    const user = userEvent.setup();
    const { unmount } = renderBar();

    await triggerSuccessfulRepost(user);
    await screen.findByText(/new quest posted/i);

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('clears the previous toast timer when a second toast is triggered', async () => {
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    mockRepost
      .mockResolvedValueOnce({ newQuestId: 'q-a', newTitle: 'Quest A' })
      .mockResolvedValueOnce({ newQuestId: 'q-b', newTitle: 'Quest B' });

    const user = userEvent.setup();
    renderBar();

    // First repost — start timer A
    await triggerSuccessfulRepost(user);
    await screen.findByText(/new quest posted.*quest a/i);

    clearTimeoutSpy.mockClear();

    // Second repost — should clear timer A before starting timer B
    await triggerSuccessfulRepost(user);
    await screen.findByText(/new quest posted.*quest b/i);

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
