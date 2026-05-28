import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useRef } from 'react';
import { SeekCounselDialog } from '../seek-counsel-dialog';
import { ApiError } from '../../../lib/api';

const mockBlock = vi.fn();

vi.mock('../../../lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../lib/api')>();
  return {
    ...original,
    api: {
      ...original.api,
      quests: {
        ...original.api.quests,
        block: (...args: unknown[]) => mockBlock(...args),
      },
    },
  };
});

function renderDialog(onClose = vi.fn()) {
  const triggerRef = createRef<HTMLButtonElement>();
  return { ...render(<SeekCounselDialog questId="q-1" triggerRef={triggerRef} onClose={onClose} />), onClose };
}

beforeEach(() => {
  mockBlock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('SeekCounselDialog', () => {
  it('renders the dialog with correct role and label', () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: /seek counsel/i })).toBeDefined();
  });

  it('renders textarea labeled "What are you waiting on?"', () => {
    renderDialog();
    expect(screen.getByLabelText(/what are you waiting on/i)).toBeDefined();
  });

  it('renders Cancel and Mark blocked buttons', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /mark blocked/i })).toBeDefined();
  });

  it('focuses the textarea on mount', () => {
    renderDialog();
    const textarea = screen.getByLabelText(/what are you waiting on/i);
    expect(document.activeElement).toBe(textarea);
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog(onClose);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when ESC is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog(onClose);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog(onClose);
    const backdrop = screen.getByRole('dialog').parentElement!;
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('disables submit button when textarea is empty', () => {
    renderDialog();
    const submit = screen.getByRole('button', { name: /mark blocked/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('enables submit button when text is entered', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText(/what are you waiting on/i), 'waiting for approval');
    const submit = screen.getByRole('button', { name: /mark blocked/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
  });

  it('shows character count', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText(/what are you waiting on/i), 'hello');
    expect(screen.getByText('5/1000')).toBeDefined();
  });

  it('calls api.quests.block with questId and description on submit', async () => {
    const user = userEvent.setup();
    mockBlock.mockResolvedValueOnce({});
    renderDialog();
    await user.type(screen.getByLabelText(/what are you waiting on/i), 'waiting for review');
    await user.click(screen.getByRole('button', { name: /mark blocked/i }));
    expect(mockBlock).toHaveBeenCalledWith('q-1', 'waiting for review');
  });

  it('calls onClose after successful submit', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockBlock.mockResolvedValueOnce({});
    renderDialog(onClose);
    await user.type(screen.getByLabelText(/what are you waiting on/i), 'waiting for review');
    await user.click(screen.getByRole('button', { name: /mark blocked/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('shows loading state while submitting', async () => {
    const user = userEvent.setup();
    let resolveBlock: () => void;
    mockBlock.mockReturnValueOnce(new Promise<void>((resolve) => { resolveBlock = resolve; }));
    renderDialog();
    await user.type(screen.getByLabelText(/what are you waiting on/i), 'waiting');
    await user.click(screen.getByRole('button', { name: /mark blocked/i }));
    expect(screen.getByRole('button', { name: /marking/i })).toBeDefined();
    const cancelBtn = screen.getByRole('button', { name: /cancel/i }) as HTMLButtonElement;
    expect(cancelBtn.disabled).toBe(true);
    resolveBlock!();
  });

  it('shows error message on API failure', async () => {
    const user = userEvent.setup();
    mockBlock.mockRejectedValueOnce(new ApiError('Quest not found', { status: 404 }));
    renderDialog();
    await user.type(screen.getByLabelText(/what are you waiting on/i), 'waiting');
    await user.click(screen.getByRole('button', { name: /mark blocked/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(screen.getByText('Quest not found')).toBeDefined();
  });

  it('shows generic error message on non-ApiError failure', async () => {
    const user = userEvent.setup();
    mockBlock.mockRejectedValueOnce(new Error('network error'));
    renderDialog();
    await user.type(screen.getByLabelText(/what are you waiting on/i), 'waiting');
    await user.click(screen.getByRole('button', { name: /mark blocked/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(screen.getByText('Failed to mark blocked. Try again.')).toBeDefined();
  });

  it('focus trap: Tab from Mark blocked wraps focus to textarea', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText(/what are you waiting on/i), 'waiting');
    const markBlockedBtn = screen.getByRole('button', { name: /mark blocked/i });
    markBlockedBtn.focus();
    expect(document.activeElement).toBe(markBlockedBtn);
    await user.keyboard('{Tab}');
    expect(document.activeElement).toBe(screen.getByLabelText(/what are you waiting on/i));
  });

  it('focus trap: Shift+Tab from textarea wraps focus to Mark blocked', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText(/what are you waiting on/i), 'waiting');
    const textarea = screen.getByLabelText(/what are you waiting on/i);
    textarea.focus();
    expect(document.activeElement).toBe(textarea);
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /mark blocked/i }));
  });

  it('returns focus to trigger element when dialog unmounts', () => {
    function WithTrigger({ show }: { show: boolean }) {
      const triggerRef = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={triggerRef} type="button">Seek counsel</button>
          {show && <SeekCounselDialog questId="q-1" triggerRef={triggerRef} onClose={() => {}} />}
        </>
      );
    }
    const { rerender } = render(<WithTrigger show={true} />);
    rerender(<WithTrigger show={false} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /seek counsel/i }));
  });

  it('re-enables submit after an error', async () => {
    const user = userEvent.setup();
    mockBlock.mockRejectedValueOnce(new ApiError('server error', { status: 500 }));
    renderDialog();
    await user.type(screen.getByLabelText(/what are you waiting on/i), 'waiting');
    await user.click(screen.getByRole('button', { name: /mark blocked/i }));
    await waitFor(() => screen.getByRole('alert'));
    const submit = screen.getByRole('button', { name: /mark blocked/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
  });
});
