import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import RepostDialog from '../repost-dialog';
import type { HallOfReturnsQuest } from '../../../../lib/api';

const mockRepost = vi.fn();

vi.mock('../../../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      quests: {
        ...actual.api.quests,
        repost: (...args: unknown[]) => mockRepost(...args),
      },
    },
  };
});

function makeQuest(overrides: Partial<HallOfReturnsQuest> = {}): HallOfReturnsQuest {
  return {
    id: 'quest-1',
    epicId: null,
    title: 'Slay the Dragon',
    description: 'A dangerous quest.',
    acceptanceCriteria: ['Dragon defeated', 'No casualties'],
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

function renderDialog(onClose = vi.fn(), onSuccess = vi.fn(), quest = makeQuest()) {
  const triggerRef = createRef<HTMLButtonElement>();
  return render(
    <RepostDialog
      questId="quest-1"
      quest={quest}
      triggerRef={triggerRef}
      onClose={onClose}
      onSuccess={onSuccess}
    />,
  );
}

describe('RepostDialog', () => {
  beforeEach(() => {
    mockRepost.mockResolvedValue({ newQuestId: 'new-1', newTitle: 'New Dragon Quest' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog with correct role and label', () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: /re-post quest/i })).toBeDefined();
  });

  it('pre-fills acceptance criteria from quest', () => {
    renderDialog();
    expect(screen.getByDisplayValue('Dragon defeated')).toBeDefined();
    expect(screen.getByDisplayValue('No casualties')).toBeDefined();
  });

  it('pre-fills edge cases from quest', () => {
    renderDialog();
    expect(screen.getByDisplayValue('Dragon is sleeping')).toBeDefined();
  });

  it('renders Cancel and Re-post buttons', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /re-post quest/i })).toBeDefined();
  });

  it('submit button is disabled when all ACs are cleared', async () => {
    const user = userEvent.setup();
    renderDialog();
    const ac1 = screen.getByRole('textbox', { name: 'Criterion 1' });
    const ac2 = screen.getByRole('textbox', { name: 'Criterion 2' });
    await user.clear(ac1);
    await user.clear(ac2);
    const submitBtn = screen.getByRole('button', { name: /re-post quest/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog(onClose);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog(onClose);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows loading state while submitting', async () => {
    mockRepost.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: /re-post quest/i }));
    expect(screen.getByRole('button', { name: /posting/i })).toBeDefined();
    expect((screen.getByRole('button', { name: /posting/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls onSuccess with result after successful submit', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    renderDialog(vi.fn(), onSuccess);
    await user.click(screen.getByRole('button', { name: /re-post quest/i }));
    expect(onSuccess).toHaveBeenCalledWith({ newQuestId: 'new-1', newTitle: 'New Dragon Quest' });
  });

  it('passes adjustments to API on submit', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: /re-post quest/i }));
    expect(mockRepost).toHaveBeenCalledWith('quest-1', {
      acceptanceCriteria: ['Dragon defeated', 'No casualties'],
      edgeCases: ['Dragon is sleeping'],
    });
  });

  it('shows error on server failure', async () => {
    const { ApiError } = await import('../../../../lib/api');
    mockRepost.mockRejectedValue(new ApiError('Server error', { status: 500 }));
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: /re-post quest/i }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/server error/i);
  });

  it('re-enables submit after server error', async () => {
    const { ApiError } = await import('../../../../lib/api');
    mockRepost.mockRejectedValue(new ApiError('Fail', { status: 500 }));
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: /re-post quest/i }));
    await screen.findByRole('alert');
    expect((screen.getByRole('button', { name: /re-post quest/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('returns focus to trigger button on close', () => {
    const triggerRef = createRef<HTMLButtonElement>();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const btn = document.createElement('button');
    btn.textContent = 'Trigger';
    container.appendChild(btn);
    (triggerRef as React.MutableRefObject<HTMLButtonElement>).current = btn;
    btn.focus();

    const { unmount } = render(
      <RepostDialog
        questId="quest-1"
        quest={makeQuest()}
        triggerRef={triggerRef}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    unmount();
    expect(document.activeElement).toBe(btn);
    document.body.removeChild(container);
  });

  it('can add a new criterion', async () => {
    const user = userEvent.setup();
    renderDialog();
    const initialCount = screen.getAllByRole('textbox').length;
    await user.click(screen.getByRole('button', { name: /add criterion/i }));
    expect(screen.getAllByRole('textbox').length).toBe(initialCount + 1);
  });

  it('can remove a criterion', async () => {
    const user = userEvent.setup();
    renderDialog();
    const removeButtons = screen.getAllByRole('button', { name: /remove criterion/i });
    const initialInputCount = screen.getAllByRole('textbox').length;
    await user.click(removeButtons[0]);
    expect(screen.getAllByRole('textbox').length).toBe(initialInputCount - 1);
  });

  it('renders empty AC list for quest with no ACs', () => {
    renderDialog(vi.fn(), vi.fn(), makeQuest({ acceptanceCriteria: [] }));
    expect(screen.getByRole('textbox', { name: 'Criterion 1' })).toBeDefined();
  });
});
