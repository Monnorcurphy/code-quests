import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import FeedbackForm from '../feedback-form';

const { mockSubmitFeedback } = vi.hoisted(() => ({
  mockSubmitFeedback: vi.fn(),
}));

vi.mock('../../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      quests: {
        ...actual.api.quests,
        submitFeedback: mockSubmitFeedback,
      },
    },
  };
});

function renderFeedbackForm(questId = 'quest-1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <FeedbackForm questId={questId} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('FeedbackForm', () => {
  beforeEach(() => {
    mockSubmitFeedback.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders heading, label, textarea, and submit button', () => {
    renderFeedbackForm();
    expect(screen.getByRole('heading', { name: /leave feedback/i })).toBeDefined();
    expect(screen.getByLabelText(/your feedback/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /submit feedback/i })).toBeDefined();
  });

  it('submit button is disabled when textarea is empty', () => {
    renderFeedbackForm();
    const btn = screen.getByRole('button', { name: /submit feedback/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('submit button is disabled when textarea contains only whitespace', async () => {
    const user = userEvent.setup();
    renderFeedbackForm();
    await user.type(screen.getByLabelText(/your feedback/i), '   ');
    const btn = screen.getByRole('button', { name: /submit feedback/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('char counter updates as user types', async () => {
    const user = userEvent.setup();
    renderFeedbackForm();
    await user.type(screen.getByLabelText(/your feedback/i), 'Hello');
    expect(screen.getByText('5/2000')).toBeDefined();
  });

  it('enables submit button when text is entered', async () => {
    const user = userEvent.setup();
    renderFeedbackForm();
    await user.type(screen.getByLabelText(/your feedback/i), 'Great quest!');
    expect(
      (screen.getByRole('button', { name: /submit feedback/i }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('shows loading state while submitting', async () => {
    mockSubmitFeedback.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderFeedbackForm();
    await user.type(screen.getByLabelText(/your feedback/i), 'Some feedback');
    await user.click(screen.getByRole('button', { name: /submit feedback/i }));
    expect(screen.getByRole('button', { name: /saving feedback/i })).toBeDefined();
    expect(
      (screen.getByRole('button', { name: /saving feedback/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('shows success toast after submit', async () => {
    const user = userEvent.setup();
    renderFeedbackForm();
    await user.type(screen.getByLabelText(/your feedback/i), 'Great quest!');
    await user.click(screen.getByRole('button', { name: /submit feedback/i }));
    const status = await screen.findByRole('status');
    expect(status.textContent).toMatch(/feedback saved/i);
  });

  it('success toast schedules auto-dismiss with 3s delay', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const user = userEvent.setup();
    renderFeedbackForm();
    await user.type(screen.getByLabelText(/your feedback/i), 'Great quest!');
    await user.click(screen.getByRole('button', { name: /submit feedback/i }));
    await screen.findByRole('status');
    const calls = setTimeoutSpy.mock.calls.filter(([, delay]) => delay === 3000);
    expect(calls.length).toBeGreaterThan(0);
  });

  it('clears textarea after successful submit', async () => {
    const user = userEvent.setup();
    renderFeedbackForm();
    const textarea = screen.getByLabelText(/your feedback/i) as HTMLTextAreaElement;
    await user.type(textarea, 'Great quest!');
    await user.click(screen.getByRole('button', { name: /submit feedback/i }));
    await screen.findByRole('status');
    expect(textarea.value).toBe('');
  });

  it('shows persistent error message on server error', async () => {
    mockSubmitFeedback.mockRejectedValue(new Error('Internal server error'));
    const user = userEvent.setup();
    renderFeedbackForm();
    await user.type(screen.getByLabelText(/your feedback/i), 'Great quest!');
    await user.click(screen.getByRole('button', { name: /submit feedback/i }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/internal server error/i);
  });

  it('error message does not schedule auto-dismiss (no 3s setTimeout)', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    mockSubmitFeedback.mockRejectedValue(new Error('Server down'));
    renderFeedbackForm();
    fireEvent.change(screen.getByLabelText(/your feedback/i), { target: { value: 'Feedback' } });
    fireEvent.submit(
      screen.getByRole('button', { name: /submit feedback/i }).closest('form')!,
    );
    await screen.findByRole('alert');
    const dismissCalls = setTimeoutSpy.mock.calls.filter(([, delay]) => delay === 3000);
    expect(dismissCalls.length).toBe(0);
  });

  it('shows field-named error when API returns field error', async () => {
    const { ApiError } = await import('../../../lib/api');
    mockSubmitFeedback.mockRejectedValue(
      new ApiError('must be between 1 and 2000 chars', { field: 'text', status: 400 }),
    );
    const user = userEvent.setup();
    renderFeedbackForm();
    await user.type(screen.getByLabelText(/your feedback/i), 'x');
    await user.click(screen.getByRole('button', { name: /submit feedback/i }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/text/i);
    expect(alert.textContent).toMatch(/must be between/i);
  });

  it('disables submit button when over 2000 char limit', async () => {
    renderFeedbackForm();
    const overLimitText = 'a'.repeat(2001);
    fireEvent.change(screen.getByLabelText(/your feedback/i), {
      target: { value: overLimitText },
    });
    await waitFor(() => {
      expect(
        (screen.getByRole('button', { name: /submit feedback/i }) as HTMLButtonElement).disabled,
      ).toBe(true);
    });
  });

  it('textarea has aria-describedby pointing to char counter', () => {
    renderFeedbackForm();
    const textarea = screen.getByLabelText(/your feedback/i) as HTMLTextAreaElement;
    const describedBy = textarea.getAttribute('aria-describedby') ?? '';
    const counterId = describedBy.split(' ')[0];
    expect(document.getElementById(counterId)).not.toBeNull();
    expect(document.getElementById(counterId)?.textContent).toMatch(/0\/2000/);
  });
});
