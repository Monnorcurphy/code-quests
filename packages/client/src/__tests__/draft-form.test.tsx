import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DraftForm from '../features/quests/draft-form';
import { api, ApiError } from '../lib/api';
import type { Quest } from '@code-quests/shared';

vi.mock('../lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/api')>();
  return {
    ...original,
    api: {
      adventurers: { list: vi.fn().mockResolvedValue([]) },
      quests: {
        list: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
      },
      epics: { list: vi.fn().mockResolvedValue([]) },
      projects: {
        list: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

const mockQuest: Quest = {
  id: 'quest-1',
  epicId: null,
    projectId: null,
  title: 'Implement dark mode toggle',
  description: '',
  acceptanceCriteria: [],
  edgeCases: [],
  context: '',
  status: 'idle',
  adventurerId: null,
  agentId: null,
  equipment: { skillIds: [], toolIds: [], mcpServerIds: [] },
  specAudit: null,
  failureSummary: null,
  inputRequest: null,
  userBlocker: null,
  currentScene: 'quest-forest' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function renderForm(props: { onCancel?: () => void; onSuccess?: () => void } = {}) {
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
        <DraftForm
          onCancel={props.onCancel ?? vi.fn()}
          onSuccess={props.onSuccess ?? vi.fn()}
        />
      </QueryClientProvider>,
    ),
  };
}

describe('DraftForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders title, description, AC fieldset, and action buttons', () => {
    renderForm();
    expect(screen.getByLabelText('Title')).toBeDefined();
    expect(screen.getByLabelText('Description')).toBeDefined();
    expect(screen.getByRole('group', { name: 'Acceptance Criteria' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Draft Quest' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();
  });

  it('shows inline error when submitting with an empty title', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Draft Quest' }));

    expect(screen.getByText('Title is required')).toBeDefined();
  });

  it('shows loading state while submitting', async () => {
    vi.mocked(api.quests.create).mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Title'), 'My Quest');
    await user.click(screen.getByRole('button', { name: 'Draft Quest' }));

    const submitBtn = screen.getByRole('button', { name: 'Drafting…' });
    expect(submitBtn).toBeDefined();
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows success message after successful submission', async () => {
    vi.mocked(api.quests.create).mockResolvedValue(mockQuest);
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Title'), 'My Quest');
    await user.click(screen.getByRole('button', { name: 'Draft Quest' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeDefined();
    });
    expect(screen.getByText('Quest drafted! It now appears on the Quest Board.')).toBeDefined();
  });

  it('calls onSuccess after 3 seconds on successful submission', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(api.quests.create).mockResolvedValue(mockQuest);
    const onSuccess = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderForm({ onSuccess });

    await user.type(screen.getByLabelText('Title'), 'My Quest');
    await user.click(screen.getByRole('button', { name: 'Draft Quest' }));

    await waitFor(() => {
      expect(screen.getByText('Quest drafted! It now appears on the Quest Board.')).toBeDefined();
    });
    expect(onSuccess).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('shows server error when API call fails', async () => {
    vi.mocked(api.quests.create).mockRejectedValue(new Error('Server unavailable'));
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Title'), 'My Quest');
    await user.click(screen.getByRole('button', { name: 'Draft Quest' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
    expect(screen.getByText('Server unavailable')).toBeDefined();
  });

  it('server error from ApiError shows correctly', async () => {
    vi.mocked(api.quests.create).mockRejectedValue(
      new ApiError('Title already exists', { status: 400 }),
    );
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Title'), 'My Quest');
    await user.click(screen.getByRole('button', { name: 'Draft Quest' }));

    await waitFor(() => {
      expect(screen.getByText('Title already exists')).toBeDefined();
    });
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    renderForm({ onCancel });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('can add a new AC row', async () => {
    const user = userEvent.setup();
    renderForm();

    const acList = screen.getByRole('list', { name: 'Acceptance criteria list' });
    expect(acList.querySelectorAll('li').length).toBe(1);

    await user.click(screen.getByRole('button', { name: '+ Add Criterion' }));

    expect(acList.querySelectorAll('li').length).toBe(2);
  });

  it('can remove an AC row when multiple exist', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: '+ Add Criterion' }));

    const removeButtons = screen.getAllByRole('button', { name: /Remove criterion/i });
    expect(removeButtons.length).toBe(2);

    await user.click(removeButtons[1]);

    const acList = screen.getByRole('list', { name: 'Acceptance criteria list' });
    expect(acList.querySelectorAll('li').length).toBe(1);
  });

  it('remove button is disabled when only one AC row exists', () => {
    renderForm();
    const removeBtn = screen.getByRole('button', { name: 'Remove criterion 1' });
    expect((removeBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('title field respects maxLength of 200', () => {
    renderForm();
    const titleInput = screen.getByLabelText('Title');
    expect((titleInput as HTMLInputElement).maxLength).toBe(200);
  });

  it('AC input respects maxLength of 500', () => {
    renderForm();
    const acInput = screen.getByLabelText('Criterion 1');
    expect((acInput as HTMLInputElement).maxLength).toBe(500);
  });

  it('submits with acceptance criteria included', async () => {
    vi.mocked(api.quests.create).mockResolvedValue(mockQuest);
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Title'), 'My Quest');
    await user.type(screen.getByLabelText('Criterion 1'), 'It should work');
    await user.click(screen.getByRole('button', { name: 'Draft Quest' }));

    await waitFor(() => {
      expect(
        screen.getByText('Quest drafted! It now appears on the Quest Board.'),
      ).toBeDefined();
    });
    expect(vi.mocked(api.quests.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'My Quest',
        acceptanceCriteria: ['It should work'],
      }),
      expect.anything(), // TanStack Query v5 passes mutation context as second arg
    );
  });
});
