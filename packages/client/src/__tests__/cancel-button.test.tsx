import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CancelButton from '../features/quests/cancel-button';
import type { Quest } from '@code-quests/shared';

const { mockCancel } = vi.hoisted(() => ({
  mockCancel: vi.fn(),
}));

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      quests: { ...actual.api.quests, cancel: mockCancel },
    },
  };
});

function makeCancelledQuest(): Quest {
  return {
    id: 'q-test',
    epicId: null,
    projectId: null,
    title: 'Test Quest',
    description: '',
    acceptanceCriteria: [],
    edgeCases: [],
    context: '',
    status: 'failed',
    adventurerId: null,
    agentId: null,
    equipment: { skillIds: [], toolIds: [], mcpServerIds: [] },
    specAudit: null,
    failureSummary: { reason: 'User cancelled', recommendation: 'retire' },
    inputRequest: null,
    userBlocker: null,
    currentScene: 'quest-forest' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function renderButton(questId = 'q-test') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CancelButton questId={questId} />
    </QueryClientProvider>,
  );
}

describe('CancelButton', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockCancel.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders "Cancel quest" button in idle state', () => {
    renderButton();
    expect(screen.getByRole('button', { name: /cancel quest/i })).toBeDefined();
  });

  it('does NOT call cancel on first click — shows confirmation dialog', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderButton();

    await user.click(screen.getByRole('button', { name: /cancel quest/i }));

    expect(mockCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeDefined();
    expect(screen.getByText(/abandon this quest/i)).toBeDefined();
  });

  it('confirm dialog has both "Keep going" and "Abandon quest" buttons', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderButton();

    await user.click(screen.getByRole('button', { name: /cancel quest/i }));

    expect(screen.getByRole('button', { name: /keep going/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /abandon quest/i })).toBeDefined();
  });

  it('"Keep going" dismisses the dialog without cancelling', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderButton();

    await user.click(screen.getByRole('button', { name: /cancel quest/i }));
    await user.click(screen.getByRole('button', { name: /keep going/i }));

    expect(mockCancel).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('button', { name: /cancel quest/i })).toBeDefined();
  });

  it('moves focus to "Keep going" button when confirmation dialog opens', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderButton();

    await user.click(screen.getByRole('button', { name: /cancel quest/i }));

    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: /keep going/i }),
      );
    });
  });

  it('shows loading state (disabled + aria-busy) after confirming cancel', async () => {
    mockCancel.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderButton();

    await user.click(screen.getByRole('button', { name: /cancel quest/i }));
    await user.click(screen.getByRole('button', { name: /abandon quest/i }));

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /cancelling/i });
      expect(btn.hasAttribute('disabled')).toBe(true);
      expect(btn.getAttribute('aria-busy')).toBe('true');
    });
  });

  it('shows success message after cancel completes', async () => {
    mockCancel.mockResolvedValue(makeCancelledQuest());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderButton();

    await user.click(screen.getByRole('button', { name: /cancel quest/i }));
    await user.click(screen.getByRole('button', { name: /abandon quest/i }));

    await waitFor(() => {
      const status = screen.getByRole('status');
      expect(status.textContent).toMatch(/quest cancelled/i);
    });
  });

  it('success message auto-dismisses after 3 seconds', async () => {
    mockCancel.mockResolvedValue(makeCancelledQuest());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderButton();

    await user.click(screen.getByRole('button', { name: /cancel quest/i }));
    await user.click(screen.getByRole('button', { name: /abandon quest/i }));

    await waitFor(() => screen.getByRole('status'));

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull();
    });
  });

  it('shows persistent error message on cancel failure', async () => {
    mockCancel.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderButton();

    await user.click(screen.getByRole('button', { name: /cancel quest/i }));
    await user.click(screen.getByRole('button', { name: /abandon quest/i }));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toMatch(/server error/i);
    });

    // Error must NOT auto-dismiss
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByRole('alert')).toBeDefined();
  });

  it('re-enables cancel button after error so user can retry', async () => {
    mockCancel.mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderButton();

    await user.click(screen.getByRole('button', { name: /cancel quest/i }));
    await user.click(screen.getByRole('button', { name: /abandon quest/i }));

    await waitFor(() => screen.getByRole('alert'));
    expect(screen.getByRole('button', { name: /cancel quest/i })).toBeDefined();
  });

  it('Escape dismisses the confirm dialog without cancelling the quest', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderButton();

    await user.click(screen.getByRole('button', { name: /cancel quest/i }));
    expect(screen.getByRole('alertdialog')).toBeDefined();

    await user.keyboard('{Escape}');

    expect(mockCancel).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('button', { name: /cancel quest/i })).toBeDefined();
  });

  it('Escape does NOT fire when confirm dialog is closed (idle state)', async () => {
    const outerHandler = vi.fn();
    document.addEventListener('keydown', outerHandler, false);

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderButton();

    // Dialog is NOT open — Escape should bubble normally to outer handlers
    await user.keyboard('{Escape}');

    expect(outerHandler).toHaveBeenCalledTimes(1);
    document.removeEventListener('keydown', outerHandler, false);
  });
});
