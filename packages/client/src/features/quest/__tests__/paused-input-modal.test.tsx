import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PausedInputModal } from '../paused-input-modal';
import { useQuestStore } from '../../../stores/quest-store';
import { ApiError } from '../../../lib/api';
import type { InputRequest } from '@code-quests/shared';

const mockRespondInput = vi.fn();
const mockCancel = vi.fn();

vi.mock('../../../lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../lib/api')>();
  return {
    ...original,
    api: {
      ...original.api,
      quests: {
        ...original.api.quests,
        respondInput: (...args: unknown[]) => mockRespondInput(...args),
        cancel: (...args: unknown[]) => mockCancel(...args),
      },
    },
  };
});

const SAMPLE_REQUEST: InputRequest = {
  question: 'Should I use approach A or approach B?',
  awaitingSince: new Date().toISOString(),
};

const SAMPLE_REQUEST_WITH_FRAMING: InputRequest = {
  question: 'Should I use approach A or approach B?',
  awaitingSince: new Date().toISOString(),
  adventureFraming: 'Brielle pauses at the crossroads, weighing two paths.',
};

function renderModal() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PausedInputModal questId="q-1" />
    </QueryClientProvider>,
  );
}

function setInputState(request: InputRequest | null, status: 'paused_input' | 'active' = 'paused_input') {
  act(() => {
    useQuestStore.getState().setStatus('q-1', status);
    if (request) {
      useQuestStore.getState().setInputRequest('q-1', request);
    } else {
      useQuestStore.getState().clearInputRequest('q-1');
    }
  });
}

beforeEach(() => {
  useQuestStore.getState().reset('q-1');
  mockRespondInput.mockReset();
  mockCancel.mockReset();
});

afterEach(() => { vi.clearAllMocks(); });

describe('PausedInputModal', () => {
  it('renders nothing when status is active', () => {
    act(() => { useQuestStore.getState().setStatus('q-1', 'active'); });
    const { container } = renderModal();
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when status is paused_input but inputRequest is null', () => {
    act(() => { useQuestStore.getState().setStatus('q-1', 'paused_input'); });
    const { container } = renderModal();
    expect(container.firstChild).toBeNull();
  });

  it('renders modal when status is paused_input and inputRequest is set', () => {
    setInputState(SAMPLE_REQUEST);
    renderModal();
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/the path forks/i)).toBeDefined();
  });

  it('shows raw question when no adventureFraming', () => {
    setInputState(SAMPLE_REQUEST);
    renderModal();
    expect(screen.getByText(SAMPLE_REQUEST.question)).toBeDefined();
  });

  it('shows adventureFraming when present', () => {
    setInputState(SAMPLE_REQUEST_WITH_FRAMING);
    renderModal();
    expect(screen.getByText(SAMPLE_REQUEST_WITH_FRAMING.adventureFraming!)).toBeDefined();
    expect(screen.queryByText(SAMPLE_REQUEST_WITH_FRAMING.question)).toBeNull();
  });

  it('has aria-modal=true and body uses role=alert', () => {
    setInputState(SAMPLE_REQUEST);
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const body = screen.getByRole('alert');
    expect(body.textContent).toContain(SAMPLE_REQUEST.question);
  });

  it('disables Send reply button when textarea is empty', () => {
    setInputState(SAMPLE_REQUEST);
    renderModal();
    const btn = screen.getByRole('button', { name: /send reply/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('enables Send reply button when textarea has text', async () => {
    const user = userEvent.setup();
    setInputState(SAMPLE_REQUEST);
    renderModal();
    await user.type(screen.getByLabelText(/your reply/i), 'Use approach A');
    const btn = screen.getByRole('button', { name: /send reply/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('calls respondInput with questId and reply text on submit', async () => {
    const user = userEvent.setup();
    mockRespondInput.mockResolvedValueOnce({});
    setInputState(SAMPLE_REQUEST);
    renderModal();
    await user.type(screen.getByLabelText(/your reply/i), 'Use approach A');
    await user.click(screen.getByRole('button', { name: /send reply/i }));
    expect(mockRespondInput).toHaveBeenCalledWith('q-1', 'Use approach A');
  });

  it('shows error on API failure', async () => {
    const user = userEvent.setup();
    mockRespondInput.mockRejectedValueOnce(new ApiError('Request failed', { status: 500 }));
    setInputState(SAMPLE_REQUEST);
    renderModal();
    await user.type(screen.getByLabelText(/your reply/i), 'My reply');
    await user.click(screen.getByRole('button', { name: /send reply/i }));
    await waitFor(() => expect(screen.getByText('Request failed')).toBeDefined());
  });

  it('shows loading state while submitting', async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    mockRespondInput.mockReturnValueOnce(new Promise<void>((r) => { resolve = r; }));
    setInputState(SAMPLE_REQUEST);
    renderModal();
    await user.type(screen.getByLabelText(/your reply/i), 'My reply');
    await user.click(screen.getByRole('button', { name: /send reply/i }));
    expect(screen.getByRole('button', { name: /sending/i })).toBeDefined();
    act(() => { resolve(); });
  });

  it('calls cancel API when Cancel quest is clicked', async () => {
    const user = userEvent.setup();
    mockCancel.mockResolvedValueOnce({});
    setInputState(SAMPLE_REQUEST);
    renderModal();
    await user.click(screen.getByRole('button', { name: /cancel.*quest/i }));
    expect(mockCancel).toHaveBeenCalledWith('q-1');
  });
});
