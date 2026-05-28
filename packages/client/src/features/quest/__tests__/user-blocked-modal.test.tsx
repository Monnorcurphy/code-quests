import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserBlockedModal } from '../user-blocked-modal';
import { useQuestStore } from '../../../stores/quest-store';
import { ApiError } from '../../../lib/api';
import type { UserBlocker } from '@code-quests/shared';

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
        unblock: (...args: unknown[]) => mockUnblock(...args),
        block: (...args: unknown[]) => mockBlock(...args),
      },
    },
  };
});

const SAMPLE_BLOCKER: UserBlocker = {
  rawDescription: 'Waiting for design review',
  markedAt: new Date().toISOString(),
};

const SAMPLE_BLOCKER_WITH_FRAMING: UserBlocker = {
  rawDescription: 'Waiting for design review',
  adventureFraming: 'Brielle halts at the gate, awaiting the council\'s seal.',
  markedAt: new Date().toISOString(),
};

function renderModal() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <UserBlockedModal questId="q-1" />
    </QueryClientProvider>,
  );
}

function setBlockedState(blocker: UserBlocker | null, status: 'user_blocked' | 'active' = 'user_blocked') {
  act(() => {
    useQuestStore.getState().setStatus('q-1', status);
    if (blocker) {
      useQuestStore.getState().setUserBlocker('q-1', blocker);
    } else {
      useQuestStore.getState().clearUserBlocker('q-1');
    }
  });
}

beforeEach(() => {
  useQuestStore.getState().reset('q-1');
  mockUnblock.mockReset();
  mockBlock.mockReset();
});

afterEach(() => { vi.clearAllMocks(); });

describe('UserBlockedModal', () => {
  it('renders nothing when status is active', () => {
    act(() => { useQuestStore.getState().setStatus('q-1', 'active'); });
    const { container } = renderModal();
    expect(container.firstChild).toBeNull();
  });

  it('renders modal when status is user_blocked', () => {
    setBlockedState(SAMPLE_BLOCKER);
    renderModal();
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/seeking counsel/i)).toBeDefined();
  });

  it('shows rawDescription when no adventureFraming', () => {
    setBlockedState(SAMPLE_BLOCKER);
    renderModal();
    expect(screen.getByText(SAMPLE_BLOCKER.rawDescription)).toBeDefined();
  });

  it('shows adventureFraming when present', () => {
    setBlockedState(SAMPLE_BLOCKER_WITH_FRAMING);
    renderModal();
    expect(screen.getByText(SAMPLE_BLOCKER_WITH_FRAMING.adventureFraming!)).toBeDefined();
    expect(screen.queryByText(SAMPLE_BLOCKER_WITH_FRAMING.rawDescription)).toBeNull();
  });

  it('shows fallback text when userBlocker is null', () => {
    setBlockedState(null);
    renderModal();
    expect(screen.getByText(/you have paused the quest/i)).toBeDefined();
  });

  it('has aria-modal=true on dialog', () => {
    setBlockedState(SAMPLE_BLOCKER);
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('calls api.quests.unblock when Unblock is clicked', async () => {
    const user = userEvent.setup();
    mockUnblock.mockResolvedValueOnce({});
    setBlockedState(SAMPLE_BLOCKER);
    renderModal();
    await user.click(screen.getByRole('button', { name: /^unblock$/i }));
    expect(mockUnblock).toHaveBeenCalledWith('q-1');
  });

  it('shows Resuming… and disables button while unblocking', async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    mockUnblock.mockReturnValueOnce(new Promise<void>((r) => { resolve = r; }));
    setBlockedState(SAMPLE_BLOCKER);
    renderModal();
    await user.click(screen.getByRole('button', { name: /^unblock$/i }));
    const btn = screen.getByRole('button', { name: /resuming/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    act(() => { resolve(); });
  });

  it('shows error on 409/410 response', async () => {
    const user = userEvent.setup();
    mockUnblock.mockRejectedValueOnce(new ApiError('Conflict', { status: 409 }));
    setBlockedState(SAMPLE_BLOCKER);
    renderModal();
    await user.click(screen.getByRole('button', { name: /^unblock$/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(screen.getByText(/the agent is no longer running this quest/i)).toBeDefined();
  });

  it('shows generic error on other failures', async () => {
    const user = userEvent.setup();
    mockUnblock.mockRejectedValueOnce(new ApiError('Server error', { status: 500 }));
    setBlockedState(SAMPLE_BLOCKER);
    renderModal();
    await user.click(screen.getByRole('button', { name: /^unblock$/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(screen.getByText('Server error')).toBeDefined();
  });

  it('renders Edit description button that opens seek-counsel dialog', async () => {
    const user = userEvent.setup();
    setBlockedState(SAMPLE_BLOCKER);
    renderModal();
    const editBtn = screen.getByRole('button', { name: /edit description/i });
    expect(editBtn).toBeDefined();
    await user.click(editBtn);
    expect(screen.getByRole('dialog', { name: /seek counsel/i })).toBeDefined();
  });
});
