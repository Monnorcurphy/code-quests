import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import SplitDialog from '../split-dialog';

const mockSplit = vi.fn();

vi.mock('../../../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      quests: {
        ...actual.api.quests,
        split: (...args: unknown[]) => mockSplit(...args),
      },
    },
  };
});

function renderDialog(onClose = vi.fn(), onSuccess = vi.fn()) {
  const triggerRef = createRef<HTMLButtonElement>();
  return render(
    <SplitDialog
      questId="quest-1"
      triggerRef={triggerRef}
      onClose={onClose}
      onSuccess={onSuccess}
    />,
  );
}

describe('SplitDialog', () => {
  beforeEach(() => {
    mockSplit.mockResolvedValue({ questIds: ['a', 'b'], titles: ['Quest A', 'Quest B'] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog with correct role and label', () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: /break into smaller/i })).toBeDefined();
  });

  it('starts with two child quest stubs', () => {
    renderDialog();
    expect(screen.getByLabelText(/child quest 1/i)).toBeDefined();
    expect(screen.getByLabelText(/child quest 2/i)).toBeDefined();
    expect(screen.queryByLabelText(/child quest 3/i)).toBeNull();
  });

  it('Submit button is disabled initially (no valid children)', () => {
    renderDialog();
    const submitBtn = screen.getByRole('button', { name: /split into/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('Submit button remains disabled with only one valid child', async () => {
    const user = userEvent.setup();
    renderDialog();
    const titleInputs = screen.getAllByRole('textbox', { name: /title/i });
    const acInputs = screen.getAllByRole('textbox', { name: /criterion 1 for quest 1/i });
    await user.type(titleInputs[0], 'Quest A');
    await user.type(acInputs[0], 'AC for A');
    const submitBtn = screen.getByRole('button', { name: /split into/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables Submit when two valid children are filled', async () => {
    const user = userEvent.setup();
    renderDialog();
    const titleInputs = screen.getAllByRole('textbox', { name: 'Title' });
    await user.type(titleInputs[0], 'Quest A');
    await user.type(titleInputs[1], 'Quest B');
    const ac1 = screen.getByRole('textbox', { name: 'Criterion 1 for quest 1' });
    const ac2 = screen.getByRole('textbox', { name: 'Criterion 1 for quest 2' });
    await user.type(ac1, 'AC 1');
    await user.type(ac2, 'AC 2');
    const submitBtn = screen.getByRole('button', { name: /split into/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('can add a third child quest', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: /\+ add quest/i }));
    expect(screen.getByLabelText(/child quest 3/i)).toBeDefined();
  });

  it('can remove a child quest (only when >2 exist)', async () => {
    const user = userEvent.setup();
    renderDialog();
    expect(screen.queryByRole('button', { name: /remove quest/i })).toBeNull();
    await user.click(screen.getByRole('button', { name: /\+ add quest/i }));
    const removeButtons = screen.getAllByRole('button', { name: /remove quest/i });
    expect(removeButtons.length).toBe(3);
    await user.click(removeButtons[2]);
    expect(screen.queryByLabelText(/child quest 3/i)).toBeNull();
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
    mockSplit.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderDialog();
    const titleInputs = screen.getAllByRole('textbox', { name: 'Title' });
    await user.type(titleInputs[0], 'Quest A');
    await user.type(titleInputs[1], 'Quest B');
    const ac1 = screen.getByRole('textbox', { name: 'Criterion 1 for quest 1' });
    const ac2 = screen.getByRole('textbox', { name: 'Criterion 1 for quest 2' });
    await user.type(ac1, 'AC 1');
    await user.type(ac2, 'AC 2');
    await user.click(screen.getByRole('button', { name: /split into/i }));
    expect(screen.getByRole('button', { name: /splitting/i })).toBeDefined();
    expect((screen.getByRole('button', { name: /splitting/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls onSuccess with result after successful submit', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    renderDialog(vi.fn(), onSuccess);
    const titleInputs = screen.getAllByRole('textbox', { name: 'Title' });
    await user.type(titleInputs[0], 'Quest A');
    await user.type(titleInputs[1], 'Quest B');
    const ac1 = screen.getByRole('textbox', { name: 'Criterion 1 for quest 1' });
    const ac2 = screen.getByRole('textbox', { name: 'Criterion 1 for quest 2' });
    await user.type(ac1, 'AC 1');
    await user.type(ac2, 'AC 2');
    await user.click(screen.getByRole('button', { name: /split into/i }));
    expect(onSuccess).toHaveBeenCalledWith({ questIds: ['a', 'b'], titles: ['Quest A', 'Quest B'] });
  });

  it('passes correct payload to API', async () => {
    const user = userEvent.setup();
    renderDialog();
    const titleInputs = screen.getAllByRole('textbox', { name: 'Title' });
    await user.type(titleInputs[0], 'Quest A');
    await user.type(titleInputs[1], 'Quest B');
    const ac1 = screen.getByRole('textbox', { name: 'Criterion 1 for quest 1' });
    const ac2 = screen.getByRole('textbox', { name: 'Criterion 1 for quest 2' });
    await user.type(ac1, 'AC for A');
    await user.type(ac2, 'AC for B');
    await user.click(screen.getByRole('button', { name: /split into/i }));
    expect(mockSplit).toHaveBeenCalledWith('quest-1', [
      { title: 'Quest A', description: '', acceptanceCriteria: ['AC for A'] },
      { title: 'Quest B', description: '', acceptanceCriteria: ['AC for B'] },
    ]);
  });

  it('shows error on server failure', async () => {
    const { ApiError } = await import('../../../../lib/api');
    mockSplit.mockRejectedValue(new ApiError('Server error', { status: 500 }));
    const user = userEvent.setup();
    renderDialog();
    const titleInputs = screen.getAllByRole('textbox', { name: 'Title' });
    await user.type(titleInputs[0], 'Quest A');
    await user.type(titleInputs[1], 'Quest B');
    const ac1 = screen.getByRole('textbox', { name: 'Criterion 1 for quest 1' });
    const ac2 = screen.getByRole('textbox', { name: 'Criterion 1 for quest 2' });
    await user.type(ac1, 'AC 1');
    await user.type(ac2, 'AC 2');
    await user.click(screen.getByRole('button', { name: /split into/i }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/server error/i);
  });

  it('re-enables submit after server error', async () => {
    const { ApiError } = await import('../../../../lib/api');
    mockSplit.mockRejectedValue(new ApiError('Fail', { status: 500 }));
    const user = userEvent.setup();
    renderDialog();
    const titleInputs = screen.getAllByRole('textbox', { name: 'Title' });
    await user.type(titleInputs[0], 'Quest A');
    await user.type(titleInputs[1], 'Quest B');
    const ac1 = screen.getByRole('textbox', { name: 'Criterion 1 for quest 1' });
    const ac2 = screen.getByRole('textbox', { name: 'Criterion 1 for quest 2' });
    await user.type(ac1, 'AC 1');
    await user.type(ac2, 'AC 2');
    await user.click(screen.getByRole('button', { name: /split into/i }));
    await screen.findByRole('alert');
    expect((screen.getByRole('button', { name: /split into/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('can add and fill AC for a child quest', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getAllByRole('button', { name: /add criterion/i })[0]);
    const criterion2 = screen.getByRole('textbox', { name: 'Criterion 2 for quest 1' });
    expect(criterion2).toBeDefined();
    await user.type(criterion2, 'Extra AC');
    expect((criterion2 as HTMLInputElement).value).toBe('Extra AC');
  });

  it('returns focus to trigger button on unmount', () => {
    const triggerRef = createRef<HTMLButtonElement>();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const btn = document.createElement('button');
    btn.textContent = 'Trigger';
    container.appendChild(btn);
    (triggerRef as React.MutableRefObject<HTMLButtonElement>).current = btn;
    btn.focus();

    const { unmount } = render(
      <SplitDialog
        questId="quest-1"
        triggerRef={triggerRef}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    unmount();
    expect(document.activeElement).toBe(btn);
    document.body.removeChild(container);
  });
});
