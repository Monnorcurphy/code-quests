import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ActionBar from '../action-bar';
import type { HallOfReturnsQuest } from '../../../../lib/api';

vi.mock('../repost-dialog', () => ({
  default: ({ onClose, onSuccess }: { onClose: () => void; onSuccess: (r: { newQuestId: string; newTitle: string }) => void }) => (
    <div role="dialog" aria-label="Re-post Quest">
      <button onClick={onClose}>Close Repost</button>
      <button onClick={() => onSuccess({ newQuestId: 'new-1', newTitle: 'New Dragon Quest' })}>
        Submit Repost
      </button>
    </div>
  ),
}));

vi.mock('../retire-dialog', () => ({
  default: ({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) => (
    <div role="dialog" aria-label="Retire Quest">
      <button onClick={onClose}>Close Retire</button>
      <button onClick={onSuccess}>Submit Retire</button>
    </div>
  ),
}));

vi.mock('../split-dialog', () => ({
  default: ({ onClose, onSuccess }: { onClose: () => void; onSuccess: (r: { questIds: string[]; titles: string[] }) => void }) => (
    <div role="dialog" aria-label="Break into Smaller Quests">
      <button onClick={onClose}>Close Split</button>
      <button onClick={() => onSuccess({ questIds: ['a', 'b'], titles: ['Quest A', 'Quest B'] })}>
        Submit Split
      </button>
    </div>
  ),
}));

function makeQuest(overrides: Partial<HallOfReturnsQuest> = {}): HallOfReturnsQuest {
  return {
    id: 'quest-1',
    epicId: null,
    title: 'Slay the Dragon',
    description: 'A dangerous quest.',
    acceptanceCriteria: ['Dragon defeated'],
    edgeCases: ['Dragon is sleeping'],
    context: '',
    status: 'returned_to_town',
    adventurerId: 'adv-1',
    agentId: null,
    failureSummary: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    adventurer: null,
    fatalMonster: null,
    ...overrides,
  };
}

function renderActionBar(quest = makeQuest(), recommendation: HallOfReturnsQuest['failureSummary'] extends { recommendation: infer R } | null ? R | undefined : undefined = undefined) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ActionBar questId="quest-1" quest={quest} recommendation={recommendation} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ActionBar', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders all three action buttons', () => {
    renderActionBar();
    expect(screen.getByRole('button', { name: /re-post quest/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /retire quest/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /break into smaller/i })).toBeDefined();
  });

  it('no button has aria-current when no recommendation', () => {
    renderActionBar();
    const buttons = screen.getAllByRole('button');
    for (const btn of buttons) {
      expect(btn.getAttribute('aria-current')).toBeNull();
    }
  });

  it('marks Re-post button as recommended for repost_with_clarification', () => {
    renderActionBar(makeQuest(), 'repost_with_clarification');
    const repostBtn = screen.getByRole('button', { name: /re-post quest/i });
    expect(repostBtn.getAttribute('aria-current')).toBe('true');
    expect(screen.getAllByText('Recommended').length).toBe(1);
  });

  it('marks Retire button as recommended for retire recommendation', () => {
    renderActionBar(makeQuest(), 'retire');
    const retireBtn = screen.getByRole('button', { name: /retire quest/i });
    expect(retireBtn.getAttribute('aria-current')).toBe('true');
  });

  it('marks Split button as recommended for break_into_smaller', () => {
    renderActionBar(makeQuest(), 'break_into_smaller');
    const splitBtn = screen.getByRole('button', { name: /break into smaller/i });
    expect(splitBtn.getAttribute('aria-current')).toBe('true');
  });

  it('opens repost dialog when Re-post button clicked', async () => {
    const user = userEvent.setup();
    renderActionBar();
    await user.click(screen.getByRole('button', { name: /re-post quest/i }));
    expect(screen.getByRole('dialog', { name: /re-post quest/i })).toBeDefined();
  });

  it('opens retire dialog when Retire button clicked', async () => {
    const user = userEvent.setup();
    renderActionBar();
    await user.click(screen.getByRole('button', { name: /retire quest/i }));
    expect(screen.getByRole('dialog', { name: /retire quest/i })).toBeDefined();
  });

  it('opens split dialog when Split button clicked', async () => {
    const user = userEvent.setup();
    renderActionBar();
    await user.click(screen.getByRole('button', { name: /break into smaller/i }));
    expect(screen.getByRole('dialog', { name: /break into smaller/i })).toBeDefined();
  });

  it('closes repost dialog when onClose called', async () => {
    const user = userEvent.setup();
    renderActionBar();
    await user.click(screen.getByRole('button', { name: /re-post quest/i }));
    await user.click(screen.getByRole('button', { name: /close repost/i }));
    expect(screen.queryByRole('dialog', { name: /re-post quest/i })).toBeNull();
  });

  it('shows toast and linkage after successful repost', async () => {
    const user = userEvent.setup();
    renderActionBar();
    await user.click(screen.getByRole('button', { name: /re-post quest/i }));
    await user.click(screen.getByRole('button', { name: /submit repost/i }));
    expect(screen.getByRole('status').textContent).toMatch(/new quest posted/i);
    expect(screen.getByText(/re-posted as/i)).toBeDefined();
    expect(screen.getByRole('link', { name: 'New Dragon Quest' })).toBeDefined();
  });

  it('shows toast after successful retire', async () => {
    const user = userEvent.setup();
    renderActionBar();
    await user.click(screen.getByRole('button', { name: /retire quest/i }));
    await user.click(screen.getByRole('button', { name: /submit retire/i }));
    expect(screen.getByRole('status').textContent).toMatch(/quest retired/i);
  });

  it('shows toast and linkage after successful split', async () => {
    const user = userEvent.setup();
    renderActionBar();
    await user.click(screen.getByRole('button', { name: /break into smaller/i }));
    await user.click(screen.getByRole('button', { name: /submit split/i }));
    expect(screen.getByRole('status').textContent).toMatch(/split into 2 quests/i);
    expect(screen.getByRole('link', { name: 'Quest A' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Quest B' })).toBeDefined();
  });

  it('toast schedules auto-dismiss with 4s delay', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const user = userEvent.setup();
    renderActionBar();
    await user.click(screen.getByRole('button', { name: /retire quest/i }));
    await user.click(screen.getByRole('button', { name: /submit retire/i }));
    expect(screen.getByRole('status').textContent).toMatch(/quest retired/i);
    const dismissCalls = setTimeoutSpy.mock.calls.filter(([, delay]) => delay === 4000);
    expect(dismissCalls.length).toBeGreaterThan(0);
  });
});
