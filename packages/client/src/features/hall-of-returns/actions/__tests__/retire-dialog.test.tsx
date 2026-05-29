import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import RetireDialog from '../retire-dialog';

const mockRetire = vi.fn();

vi.mock('../../../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      quests: {
        ...actual.api.quests,
        retire: (...args: unknown[]) => mockRetire(...args),
      },
    },
  };
});

function renderDialog(onClose = vi.fn(), onSuccess = vi.fn()) {
  const triggerRef = createRef<HTMLButtonElement>();
  return render(
    <RetireDialog
      questId="quest-1"
      triggerRef={triggerRef}
      onClose={onClose}
      onSuccess={onSuccess}
    />,
  );
}

describe('RetireDialog', () => {
  beforeEach(() => {
    mockRetire.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog with correct role and label', () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: /retire quest/i })).toBeDefined();
  });

  it('renders permanence warning', () => {
    renderDialog();
    expect(screen.getByText(/retire this quest\? this is permanent/i)).toBeDefined();
  });

  it('renders Cancel and Retire buttons', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^retire$/i })).toBeDefined();
  });

  it('focuses Cancel button on mount (safest action)', () => {
    renderDialog();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /cancel/i }));
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

  it('calls onClose when backdrop clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog(onClose);
    const backdrop = screen.getByRole('dialog').parentElement!;
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows loading state while submitting', async () => {
    mockRetire.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: /^retire$/i }));
    expect(screen.getByRole('button', { name: /retiring/i })).toBeDefined();
    expect((screen.getByRole('button', { name: /retiring/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls onSuccess after successful retire', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    renderDialog(vi.fn(), onSuccess);
    await user.click(screen.getByRole('button', { name: /^retire$/i }));
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(mockRetire).toHaveBeenCalledWith('quest-1');
  });

  it('shows error on server failure', async () => {
    const { ApiError } = await import('../../../../lib/api');
    mockRetire.mockRejectedValue(new ApiError('Server error', { status: 500 }));
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: /^retire$/i }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/server error/i);
  });

  it('re-enables Retire button after server error', async () => {
    const { ApiError } = await import('../../../../lib/api');
    mockRetire.mockRejectedValue(new ApiError('Fail', { status: 500 }));
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: /^retire$/i }));
    await screen.findByRole('alert');
    expect((screen.getByRole('button', { name: /^retire$/i }) as HTMLButtonElement).disabled).toBe(false);
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
      <RetireDialog
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

  it('traps focus within dialog on Tab', async () => {
    const user = userEvent.setup();
    renderDialog();
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    const retireBtn = screen.getByRole('button', { name: /^retire$/i });
    cancelBtn.focus();
    await user.tab();
    expect(document.activeElement).toBe(retireBtn);
    await user.tab();
    expect(document.activeElement).toBe(cancelBtn);
  });
});
