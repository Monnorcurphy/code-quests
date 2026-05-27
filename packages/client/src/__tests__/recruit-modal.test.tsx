import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RecruitModal from '../features/guild/recruit-modal';
import { api, ApiError } from '../lib/api';
import type { Adventurer } from '@code-quests/shared';

vi.mock('../lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/api')>();
  return {
    ...original,
    api: {
      adventurers: {
        list: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
      },
      quests: { list: vi.fn().mockResolvedValue([]) },
      epics: { list: vi.fn().mockResolvedValue([]) },
    },
  };
});

const mockAdventurer: Adventurer = {
  id: 'test-id-1',
  name: 'Bran the Bold',
  class: 'champion',
  modelId: 'default',
  createdAt: new Date().toISOString(),
  stats: {},
  specializations: [],
  scars: [],
};

function renderModal(props: { onCancel?: () => void; onSuccess?: () => void } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <RecruitModal onCancel={props.onCancel ?? vi.fn()} onSuccess={props.onSuccess ?? vi.fn()} />
      </QueryClientProvider>,
    ),
  };
}

describe('RecruitModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the form with name input, class select, and action buttons', () => {
    renderModal();
    expect(screen.getByLabelText('Name')).toBeDefined();
    expect(screen.getByLabelText('Class')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Recruit' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();
  });

  it('class select is constrained to the 5 valid classes', () => {
    renderModal();
    const select = screen.getByLabelText('Class');
    const options = Array.from((select as HTMLSelectElement).options).map((o) => o.value);
    expect(options).toEqual(['champion', 'ranger', 'scout', 'rogue', 'apprentice']);
  });

  it('shows inline error when submitting with an empty name', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: 'Recruit' }));

    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
    expect(screen.getByText('Name is required')).toBeDefined();
  });

  it('shows inline validation error when name is only whitespace', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText('Name'), '   ');
    await user.click(screen.getByRole('button', { name: 'Recruit' }));

    expect(screen.getByText('Name is required')).toBeDefined();
  });

  it('shows inline error via onBlur when name exceeds 80 characters', async () => {
    renderModal();
    const nameInput = screen.getByLabelText('Name');
    // fireEvent bypasses maxLength to simulate values set programmatically
    fireEvent.change(nameInput, { target: { value: 'A'.repeat(81) } });
    fireEvent.blur(nameInput);
    expect(screen.getByText('Name must be 80 characters or fewer')).toBeDefined();
  });

  it('shows loading state while submitting', async () => {
    vi.mocked(api.adventurers.create).mockImplementation(
      () => new Promise(() => {}),
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText('Name'), 'Bran');
    await user.click(screen.getByRole('button', { name: 'Recruit' }));

    const submitBtn = screen.getByRole('button', { name: 'Recruiting…' });
    expect(submitBtn).toBeDefined();
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows success message after successful submission', async () => {
    vi.mocked(api.adventurers.create).mockResolvedValue(mockAdventurer);
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText('Name'), 'Bran');
    await user.click(screen.getByRole('button', { name: 'Recruit' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeDefined();
    });
    expect(screen.getByText('Adventurer recruited! Welcome to the guild.')).toBeDefined();
  });

  it('calls onSuccess after 3 seconds on successful submission', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(api.adventurers.create).mockResolvedValue(mockAdventurer);
    const onSuccess = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderModal({ onSuccess });

    await user.type(screen.getByLabelText('Name'), 'Bran');
    await user.click(screen.getByRole('button', { name: 'Recruit' }));

    // shouldAdvanceTime lets waitFor poll normally
    await waitFor(() => {
      expect(screen.getByText('Adventurer recruited! Welcome to the guild.')).toBeDefined();
    });
    expect(onSuccess).not.toHaveBeenCalled();

    // Manually advance past the 3-second auto-dismiss
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('shows server error when API call fails', async () => {
    vi.mocked(api.adventurers.create).mockRejectedValue(
      new Error('Server unavailable'),
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText('Name'), 'Bran');
    await user.click(screen.getByRole('button', { name: 'Recruit' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
    expect(screen.getByText('Server unavailable')).toBeDefined();
  });

  it('shows field-named server error inline when API returns a name field error', async () => {
    vi.mocked(api.adventurers.create).mockRejectedValue(
      new ApiError('Name is already taken', { field: 'name', status: 400 }),
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText('Name'), 'Bran');
    await user.click(screen.getByRole('button', { name: 'Recruit' }));

    await waitFor(() => {
      expect(screen.getByText('Name is already taken')).toBeDefined();
    });
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    renderModal({ onCancel });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('error persists — server error does not auto-dismiss', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(api.adventurers.create).mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderModal();

    await user.type(screen.getByLabelText('Name'), 'Bran');
    await user.click(screen.getByRole('button', { name: 'Recruit' }));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeDefined();
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText('Network error')).toBeDefined();
  });
});
