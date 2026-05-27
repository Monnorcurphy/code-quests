import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ActiveQuestPanel from '../features/quests/active-quest-panel';
import type { AgentEvent, Quest } from '@code-quests/shared';

type SubscriberFn = (event: AgentEvent) => void;
let capturedSubscriber: SubscriberFn | null = null;

const { mockSubscribe, mockGetQuest } = vi.hoisted(() => ({
  mockSubscribe: vi.fn(),
  mockGetQuest: vi.fn(),
}));

vi.mock('../lib/quest-socket', () => ({
  subscribe: mockSubscribe,
}));

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      quests: { ...actual.api.quests, get: mockGetQuest },
    },
  };
});

function makeQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 'q-test',
    epicId: null,
    title: 'Slay the Goblin Linter',
    description: 'A noble quest',
    acceptanceCriteria: ['Linter defeated'],
    edgeCases: [],
    context: '',
    status: 'active',
    adventurerId: null,
    agentId: null,
    equipment: { skillIds: [], toolIds: [], mcpServerIds: [] },
    specAudit: null,
    failureSummary: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderPanel(questId = 'q-test') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ActiveQuestPanel questId={questId} />
    </QueryClientProvider>,
  );
}

describe('ActiveQuestPanel', () => {
  beforeEach(() => {
    capturedSubscriber = null;
    mockSubscribe.mockImplementation((_qid: string, onEvent: SubscriberFn) => {
      capturedSubscriber = onEvent;
      return () => {};
    });
    mockGetQuest.mockResolvedValue(makeQuest());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    mockGetQuest.mockImplementation(() => new Promise(() => {}));
    renderPanel();
    expect(screen.getByText(/loading quest/i)).toBeDefined();
  });

  it('renders error state when quest fails to load', async () => {
    mockGetQuest.mockRejectedValue(new Error('not found'));
    renderPanel();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/could not load quest/i);
  });

  it('has aria-live="polite" on the event feed list', async () => {
    renderPanel();
    const feed = await screen.findByRole('list', { name: /quest event feed/i });
    expect(feed.getAttribute('aria-live')).toBe('polite');
  });

  it('shows "awaiting updates" when quest is active and no events have arrived', async () => {
    renderPanel();
    await screen.findByText(/awaiting adventurer updates/i);
  });

  it('renders progress event in the feed', async () => {
    renderPanel();
    await screen.findByRole('list', { name: /quest event feed/i });

    act(() => {
      capturedSubscriber?.({
        type: 'progress',
        timestamp: new Date().toISOString(),
        message: 'Setting out from town',
      });
    });

    expect(screen.getByText('Setting out from town')).toBeDefined();
  });

  it('renders combat event with monster type in the text', async () => {
    renderPanel();
    await screen.findByRole('list', { name: /quest event feed/i });

    act(() => {
      capturedSubscriber?.({
        type: 'combat',
        timestamp: new Date().toISOString(),
        message: 'Skirmish with a goblin',
        monsterTypeId: 'goblin_linter',
      });
    });

    expect(screen.getByText(/skirmish with a goblin \(goblin_linter\)/i)).toBeDefined();
  });

  it('renders status_change event with text labels — not color only', async () => {
    renderPanel();
    await screen.findByRole('list', { name: /quest event feed/i });

    act(() => {
      capturedSubscriber?.({
        type: 'status_change',
        timestamp: new Date().toISOString(),
        from: 'idle',
        to: 'active',
      });
    });

    expect(screen.getByText(/idle.*active/i)).toBeDefined();
  });

  it('renders completed event in the feed', async () => {
    renderPanel();
    await screen.findByRole('list', { name: /quest event feed/i });

    act(() => {
      capturedSubscriber?.({
        type: 'completed',
        timestamp: new Date().toISOString(),
        summary: 'Victory!',
      });
    });

    expect(screen.getAllByText(/quest complete/i).length).toBeGreaterThan(0);
  });

  it('shows completion banner from quest status when there are no live events', async () => {
    mockGetQuest.mockResolvedValue(makeQuest({ status: 'complete' }));
    renderPanel();
    const status = await screen.findByRole('status');
    expect(status.textContent).toMatch(/quest complete/i);
  });

  it('shows failure banner from quest data with reason', async () => {
    mockGetQuest.mockResolvedValue(
      makeQuest({
        status: 'failed',
        failureSummary: {
          reason: 'Linter proved victorious',
          recommendation: 'repost_with_clarification',
        },
      }),
    );
    renderPanel();
    await screen.findByRole('alert');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/linter proved victorious/i);
  });

  it('status label uses both text and CSS class for non-color-only indication', async () => {
    renderPanel();
    await screen.findByText(/slay the goblin linter/i);
    const statusEl = screen.getByText('active', { exact: true });
    expect(statusEl.className).toContain('active-quest-status--active');
  });

  it('appends multiple events in order', async () => {
    renderPanel();
    await screen.findByRole('list', { name: /quest event feed/i });

    act(() => {
      capturedSubscriber?.({
        type: 'progress',
        timestamp: new Date().toISOString(),
        message: 'First event',
      });
      capturedSubscriber?.({
        type: 'progress',
        timestamp: new Date().toISOString(),
        message: 'Second event',
      });
    });

    const items = screen.getAllByRole('listitem');
    expect(items[0]?.textContent).toMatch(/first event/i);
    expect(items[1]?.textContent).toMatch(/second event/i);
  });

  it('calls unsubscribe on unmount', async () => {
    const unsubscribe = vi.fn();
    mockSubscribe.mockReturnValue(unsubscribe);
    const { unmount } = renderPanel();
    await screen.findByRole('list', { name: /quest event feed/i });
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('invalidates quest query on completed event', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    render(
      <QueryClientProvider client={queryClient}>
        <ActiveQuestPanel questId="q-test" />
      </QueryClientProvider>,
    );
    await screen.findByRole('list', { name: /quest event feed/i });

    act(() => {
      capturedSubscriber?.({
        type: 'completed',
        timestamp: new Date().toISOString(),
      });
    });

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['quest', 'q-test'] }),
      );
    });
  });
});
