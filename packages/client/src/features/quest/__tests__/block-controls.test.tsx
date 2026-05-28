import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BlockControls } from '../block-controls';
import { ApiError } from '../../../lib/api';

const mockUnblock = vi.fn();
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
        unblock: (...args: unknown[]) => mockUnblock(...args),
      },
    },
  };
});

// Stub seek-counsel-dialog so block-controls tests focus on button behavior
vi.mock('../seek-counsel-dialog', () => ({
  SeekCounselDialog: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog" aria-label="Seek Counsel">
      <button type="button" onClick={onClose}>Close dialog</button>
    </div>
  ),
}));

function renderControls(status: 'active' | 'paused_input' | 'user_blocked' | 'idle' | 'complete' | 'failed') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <BlockControls questId="q-1" status={status} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockUnblock.mockReset();
  mockBlock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('BlockControls — seek counsel button', () => {
  it('renders Seek counsel button when status is active', () => {
    renderControls('active');
    expect(screen.getByRole('button', { name: /seek counsel/i })).toBeDefined();
  });

  it('renders Seek counsel button when status is paused_input', () => {
    renderControls('paused_input');
    expect(screen.getByRole('button', { name: /seek counsel/i })).toBeDefined();
  });

  it('does not render Seek counsel button when status is user_blocked', () => {
    renderControls('user_blocked');
    expect(screen.queryByRole('button', { name: /seek counsel/i })).toBeNull();
  });

  it('does not render Seek counsel button when status is idle', () => {
    renderControls('idle');
    expect(screen.queryByRole('button', { name: /seek counsel/i })).toBeNull();
  });

  it('opens dialog when Seek counsel is clicked', async () => {
    const user = userEvent.setup();
    renderControls('active');
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: /seek counsel/i }));
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('closes dialog when dialog fires onClose', async () => {
    const user = userEvent.setup();
    renderControls('active');
    await user.click(screen.getByRole('button', { name: /seek counsel/i }));
    expect(screen.getByRole('dialog')).toBeDefined();
    await user.click(screen.getByRole('button', { name: /close dialog/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('BlockControls — unblock button', () => {
  it('renders Unblock button when status is user_blocked', () => {
    renderControls('user_blocked');
    expect(screen.getByRole('button', { name: /unblock/i })).toBeDefined();
  });

  it('does not render Unblock button when status is active', () => {
    renderControls('active');
    expect(screen.queryByRole('button', { name: /^unblock$/i })).toBeNull();
  });

  it('does not render Unblock button when status is idle', () => {
    renderControls('idle');
    expect(screen.queryByRole('button', { name: /unblock/i })).toBeNull();
  });

  it('shows Resuming… and disables button while unblocking', async () => {
    const user = userEvent.setup();
    let resolveUnblock!: () => void;
    mockUnblock.mockReturnValueOnce(new Promise<void>((resolve) => { resolveUnblock = resolve; }));
    renderControls('user_blocked');
    await user.click(screen.getByRole('button', { name: /unblock/i }));
    const btn = screen.getByRole('button', { name: /resuming/i }) as HTMLButtonElement;
    expect(btn).toBeDefined();
    expect(btn.disabled).toBe(true);
    await act(async () => { resolveUnblock(); });
  });

  it('calls api.quests.unblock with questId', async () => {
    const user = userEvent.setup();
    mockUnblock.mockResolvedValueOnce({});
    renderControls('user_blocked');
    await user.click(screen.getByRole('button', { name: /unblock/i }));
    expect(mockUnblock).toHaveBeenCalledWith('q-1');
  });

  it('shows error message on 409 response', async () => {
    const user = userEvent.setup();
    mockUnblock.mockRejectedValueOnce(new ApiError('Quest is not blocked', { status: 409 }));
    renderControls('user_blocked');
    await user.click(screen.getByRole('button', { name: /unblock/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(screen.getByText('The agent is no longer running this quest')).toBeDefined();
  });

  it('shows error message on 410 response', async () => {
    const user = userEvent.setup();
    mockUnblock.mockRejectedValueOnce(new ApiError('Gone', { status: 410 }));
    renderControls('user_blocked');
    await user.click(screen.getByRole('button', { name: /unblock/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(screen.getByText('The agent is no longer running this quest')).toBeDefined();
  });

  it('shows server error message on other API errors', async () => {
    const user = userEvent.setup();
    mockUnblock.mockRejectedValueOnce(new ApiError('Internal error', { status: 500 }));
    renderControls('user_blocked');
    await user.click(screen.getByRole('button', { name: /unblock/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(screen.getByText('Internal error')).toBeDefined();
  });

  it('shows generic error message on non-API error', async () => {
    const user = userEvent.setup();
    mockUnblock.mockRejectedValueOnce(new Error('network fail'));
    renderControls('user_blocked');
    await user.click(screen.getByRole('button', { name: /unblock/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(screen.getByText('Failed to unblock quest')).toBeDefined();
  });

  it('re-enables button after error', async () => {
    const user = userEvent.setup();
    mockUnblock.mockRejectedValueOnce(new ApiError('error', { status: 500 }));
    renderControls('user_blocked');
    await user.click(screen.getByRole('button', { name: /unblock/i }));
    await waitFor(() => screen.getByRole('alert'));
    const btn = screen.getByRole('button', { name: /unblock/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('clears loading state after successful unblock', async () => {
    const user = userEvent.setup();
    mockUnblock.mockResolvedValueOnce({});
    renderControls('user_blocked');
    await user.click(screen.getByRole('button', { name: /unblock/i }));
    await waitFor(() => {
      const btn = screen.queryByRole('button', { name: /resuming/i });
      expect(btn).toBeNull();
    });
  });
});

describe('BlockControls — renders nothing for terminal statuses', () => {
  it('renders no buttons when status is complete', () => {
    renderControls('complete');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders no buttons when status is failed', () => {
    renderControls('failed');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
