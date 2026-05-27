import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DispatchButton from '../features/quests/dispatch-button';
import { useTownStore } from '../stores/town-store';
import { ApiError } from '../lib/api';
import type { Quest } from '@code-quests/shared';

const { mockDispatch } = vi.hoisted(() => ({
  mockDispatch: vi.fn(),
}));

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      quests: {
        ...actual.api.quests,
        dispatch: mockDispatch,
      },
    },
  };
});

const mockSetActiveModal = vi.fn();

function makeQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 'q-dispatch',
    epicId: null,
    title: 'Dispatch Quest',
    description: 'A sufficiently long description for testing',
    acceptanceCriteria: ['Enemies defeated', 'Treasure secured'],
    edgeCases: ['Dragon is sleeping'],
    context: '',
    status: 'idle',
    adventurerId: null,
    agentId: null,
    equipment: { skillIds: [], toolIds: [], mcpServerIds: [] },
    specAudit: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const BLOCK_AUDIT = {
  runAt: new Date().toISOString(),
  gaps: [{ building: 'oracle', reason: 'Acceptance criteria missing', severity: 'block' }],
  bypassed: false,
};

function renderButton(quest: Quest) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DispatchButton quest={quest} />
    </QueryClientProvider>,
  );
}

describe('DispatchButton', () => {
  beforeEach(() => {
    // shouldAdvanceTime: real time still passes (so React Query works),
    // but component timers (countdown, success banner) are interceptable
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useTownStore.setState({ setActiveModal: mockSetActiveModal });
    mockDispatch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('shows "Dispatch quest" button for idle quest', () => {
    renderButton(makeQuest());
    expect(screen.getByRole('button', { name: /dispatch quest/i })).toBeDefined();
  });

  it('renders nothing for non-idle quest', () => {
    const { container } = renderButton(makeQuest({ status: 'active' }));
    expect(container.firstChild).toBeNull();
  });

  it('shows loading state while dispatching', async () => {
    mockDispatch.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderButton(makeQuest());

    await user.click(screen.getByRole('button', { name: /dispatch quest/i }));

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /dispatching/i });
      expect(btn.hasAttribute('disabled')).toBe(true);
    });
  });

  it('shows success banner on 200 and auto-dismisses after 3 seconds', async () => {
    mockDispatch.mockResolvedValue(makeQuest({ status: 'active' }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderButton(makeQuest());

    await user.click(screen.getByRole('button', { name: /dispatch quest/i }));
    await waitFor(() => {
      expect(screen.getByText(/quest dispatched/i)).toBeDefined();
    });

    act(() => { vi.advanceTimersByTime(3000); });

    expect(mockSetActiveModal).toHaveBeenCalledWith(null);
  });

  it('shows audit gaps and "Dispatch anyway" button on 409 with block gaps', async () => {
    mockDispatch.mockRejectedValue(
      new ApiError('Blocking gaps', {
        status: 409,
        data: { error: 'Blocking gaps', audit: BLOCK_AUDIT },
      }),
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderButton(makeQuest());

    await user.click(screen.getByRole('button', { name: /dispatch quest/i }));
    await waitFor(() => {
      expect(screen.getByText('Acceptance criteria missing')).toBeDefined();
    });

    expect(screen.getByRole('button', { name: /dispatch anyway/i })).toBeDefined();
    expect(screen.getByText('BLOCKING')).toBeDefined();
  });

  it('shows bypass confirm panel with countdown when "Dispatch anyway" is clicked', async () => {
    mockDispatch.mockRejectedValue(
      new ApiError('Blocking gaps', {
        status: 409,
        data: { error: 'Blocking gaps', audit: BLOCK_AUDIT },
      }),
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderButton(makeQuest());

    await user.click(screen.getByRole('button', { name: /dispatch quest/i }));
    await waitFor(() => screen.getByRole('button', { name: /dispatch anyway/i }));

    await user.click(screen.getByRole('button', { name: /dispatch anyway/i }));

    await waitFor(() => {
      expect(screen.getByText(/dispatch with unresolved blocking gaps/i)).toBeDefined();
    });
    const confirmBtn = screen.getByRole('button', { name: /confirm dispatch \(2s\)/i });
    expect(confirmBtn.hasAttribute('disabled')).toBe(true);
  });

  it('enables confirm button after 2-second countdown', async () => {
    mockDispatch.mockRejectedValue(
      new ApiError('Blocking gaps', {
        status: 409,
        data: { error: 'Blocking gaps', audit: BLOCK_AUDIT },
      }),
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderButton(makeQuest());

    await user.click(screen.getByRole('button', { name: /dispatch quest/i }));
    await waitFor(() => screen.getByRole('button', { name: /dispatch anyway/i }));
    await user.click(screen.getByRole('button', { name: /dispatch anyway/i }));
    await waitFor(() => screen.getByRole('button', { name: /confirm dispatch \(2s\)/i }));

    act(() => { vi.advanceTimersByTime(2000); });

    await waitFor(() => {
      const confirmBtn = screen.getByRole('button', { name: /confirm dispatch$/i });
      expect(confirmBtn.hasAttribute('disabled')).toBe(false);
    });
  });

  it('cancel button dismisses the bypass confirm panel', async () => {
    mockDispatch.mockRejectedValue(
      new ApiError('Blocking gaps', {
        status: 409,
        data: { error: 'Blocking gaps', audit: BLOCK_AUDIT },
      }),
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderButton(makeQuest());

    await user.click(screen.getByRole('button', { name: /dispatch quest/i }));
    await waitFor(() => screen.getByRole('button', { name: /dispatch anyway/i }));
    await user.click(screen.getByRole('button', { name: /dispatch anyway/i }));
    await waitFor(() => screen.getByText(/dispatch with unresolved blocking gaps/i));

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByText(/dispatch with unresolved blocking gaps/i)).toBeNull();
  });

  it('dispatches with bypass=true after confirm', async () => {
    mockDispatch
      .mockRejectedValueOnce(
        new ApiError('Blocking gaps', {
          status: 409,
          data: { error: 'Blocking gaps', audit: BLOCK_AUDIT },
        }),
      )
      .mockResolvedValueOnce(makeQuest({ status: 'active' }));

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderButton(makeQuest());

    await user.click(screen.getByRole('button', { name: /dispatch quest/i }));
    await waitFor(() => screen.getByRole('button', { name: /dispatch anyway/i }));
    await user.click(screen.getByRole('button', { name: /dispatch anyway/i }));
    await waitFor(() => screen.getByRole('button', { name: /confirm dispatch \(2s\)/i }));

    act(() => { vi.advanceTimersByTime(2000); });

    await waitFor(() => screen.getByRole('button', { name: /confirm dispatch$/i }));
    await user.click(screen.getByRole('button', { name: /confirm dispatch$/i }));

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledTimes(2);
      expect(mockDispatch).toHaveBeenLastCalledWith('q-dispatch', true);
    });
  });

  it('shows persistent error message (not auto-dismissed) on server error', async () => {
    mockDispatch.mockRejectedValue(new ApiError('Internal server error', { status: 500 }));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderButton(makeQuest());

    await user.click(screen.getByRole('button', { name: /dispatch quest/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });

    act(() => { vi.advanceTimersByTime(5000); });

    expect(screen.getByRole('alert')).toBeDefined();
    expect(mockSetActiveModal).not.toHaveBeenCalled();
  });
});
