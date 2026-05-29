import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ForgeSkillModal from '../forge-skill-modal';
import type { MonsterType, Skill } from '@code-quests/shared';

vi.mock('../../../lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../lib/api')>();
  return {
    ...original,
    api: {
      ...original.api,
      skills: {
        list: vi.fn(),
        get: vi.fn(),
        forge: vi.fn(),
        confirmCandidate: vi.fn(),
        dismissCandidate: vi.fn(),
        retire: vi.fn(),
      },
      monsters: {
        listTypes: vi.fn(),
        list: vi.fn(),
        get: vi.fn(),
        listEncounters: vi.fn(),
        listQuestEncounters: vi.fn(),
        promoteNemesis: vi.fn(),
        createType: vi.fn(),
      },
    },
  };
});

const { api } = await import('../../../lib/api');

function makeMonsterType(overrides: Partial<MonsterType> = {}): MonsterType {
  return {
    id: 'mt-goblin',
    name: 'Goblin (Linter)',
    spritePath: '/assets/monsters/goblin.png',
    defaultDifficulty: 2,
    failureSignature: 'lint errors',
    createdBy: 'system',
    ...overrides,
  };
}

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'skill-1',
    name: 'Lint Vanquisher',
    monsterTypeIds: ['mt-goblin'],
    status: 'active',
    createdBy: 'user',
    createdAt: '2024-01-01T00:00:00.000Z',
    hitCount: 0,
    implementation: '',
    ...overrides,
  };
}

const mockOnClose = vi.fn();
const mockOnSuccess = vi.fn();
const mockTriggerRef = { current: null } as React.RefObject<HTMLButtonElement>;

function renderModal(preselectedTypeId?: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    ...render(
      <QueryClientProvider client={qc}>
        <ForgeSkillModal
          preselectedTypeId={preselectedTypeId}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          triggerRef={mockTriggerRef}
        />
      </QueryClientProvider>,
    ),
    qc,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.mocked(api.monsters.listTypes).mockResolvedValue([
    makeMonsterType(),
    makeMonsterType({ id: 'mt-troll', name: 'Troll (TypeScript)' }),
  ]);
  mockOnClose.mockClear();
  mockOnSuccess.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('ForgeSkillModal — rendering', () => {
  it('renders the modal title', async () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('heading', { name: /forge a skill/i })).toBeDefined();
  });

  it('shows monster types from the API', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText('Goblin (Linter)')).toBeDefined();
      expect(screen.getByText('Troll (TypeScript)')).toBeDefined();
    });
  });

  it('pre-checks the seeded monster type when preselectedTypeId is provided', async () => {
    renderModal('mt-goblin');
    await waitFor(() => {
      const goblinCheckbox = screen.getByRole('checkbox', { name: /goblin \(linter\)/i });
      expect((goblinCheckbox as HTMLInputElement).checked).toBe(true);
    });
  });

  it('does not pre-check any type when no preselectedTypeId is given', async () => {
    renderModal();
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach((cb) => {
        expect((cb as HTMLInputElement).checked).toBe(false);
      });
    });
  });
});

describe('ForgeSkillModal — validation', () => {
  it('shows inline name error on blur when name is empty', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderModal();
    const nameInput = screen.getByLabelText(/^name/i);
    await user.click(nameInput);
    await user.tab();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/name is required/i)).toBeDefined();
    });
  });

  it('disables submit when no monster type is selected', async () => {
    renderModal();
    await waitFor(() => screen.getByText('Goblin (Linter)'));
    const submitBtn = screen.getByRole('button', { name: /forge skill/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables submit when name is empty even with a type selected', async () => {
    renderModal('mt-goblin');
    await waitFor(() => screen.getByText('Goblin (Linter)'));
    const submitBtn = screen.getByRole('button', { name: /forge skill/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables submit when name is non-empty and at least one type is selected', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderModal('mt-goblin');
    await waitFor(() => screen.getByText('Goblin (Linter)'));
    const nameInput = screen.getByLabelText(/^name/i);
    await user.type(nameInput, 'My Skill');
    const submitBtn = screen.getByRole('button', { name: /forge skill/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('ForgeSkillModal — happy path', () => {
  it('calls api.skills.forge and invalidates skills query on success', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    const forgedSkill = makeSkill({ name: 'Lint Vanquisher' });
    vi.mocked(api.skills.forge).mockResolvedValue(forgedSkill);

    const { qc } = renderModal('mt-goblin');
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    await waitFor(() => screen.getByText('Goblin (Linter)'));
    const nameInput = screen.getByLabelText(/^name/i);
    await user.type(nameInput, 'Lint Vanquisher');

    const submitBtn = screen.getByRole('button', { name: /forge skill/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(vi.mocked(api.skills.forge)).toHaveBeenCalledWith({
        name: 'Lint Vanquisher',
        monsterTypeIds: ['mt-goblin'],
        implementation: '',
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['skills'] });
    });
  });

  it('shows success message and closes modal after 3 seconds', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    vi.mocked(api.skills.forge).mockResolvedValue(makeSkill({ name: 'Lint Vanquisher' }));

    renderModal('mt-goblin');
    await waitFor(() => screen.getByText('Goblin (Linter)'));
    await user.type(screen.getByLabelText(/^name/i), 'Lint Vanquisher');
    await user.click(screen.getByRole('button', { name: /forge skill/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeDefined();
      expect(screen.getByText(/lint vanquisher.*forged/i)).toBeDefined();
    });

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith('Lint Vanquisher');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});

describe('ForgeSkillModal — error path', () => {
  it('shows a generic error message when server returns a non-field error', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    vi.mocked(api.skills.forge).mockRejectedValue(new Error('Server error'));

    renderModal('mt-goblin');
    await waitFor(() => screen.getByText('Goblin (Linter)'));
    await user.type(screen.getByLabelText(/^name/i), 'Bad Skill');
    await user.click(screen.getByRole('button', { name: /forge skill/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/server error/i)).toBeDefined();
    });
  });

  it('shows field-specific inline error when server returns field: name error', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    const fieldError = Object.assign(new Error('Name already taken.'), { field: 'name' });
    vi.mocked(api.skills.forge).mockRejectedValue(fieldError);

    renderModal('mt-goblin');
    await waitFor(() => screen.getByText('Goblin (Linter)'));
    await user.type(screen.getByLabelText(/^name/i), 'Existing Skill');
    await user.click(screen.getByRole('button', { name: /forge skill/i }));

    await waitFor(() => {
      expect(screen.getByText(/name already taken/i)).toBeDefined();
    });
  });

  it('keeps the form populated after an error', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    vi.mocked(api.skills.forge).mockRejectedValue(new Error('Server error'));

    renderModal('mt-goblin');
    await waitFor(() => screen.getByText('Goblin (Linter)'));
    await user.type(screen.getByLabelText(/^name/i), 'My Skill');
    await user.click(screen.getByRole('button', { name: /forge skill/i }));

    await waitFor(() => screen.getByRole('alert'));
    const nameInput = screen.getByLabelText(/^name/i);
    expect((nameInput as HTMLInputElement).value).toBe('My Skill');
  });
});

describe('ForgeSkillModal — dismiss', () => {
  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderModal();
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelBtn);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when overlay backdrop is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderModal();
    const backdrop = screen.getByRole('dialog');
    await user.click(backdrop);
    expect(mockOnClose).toHaveBeenCalled();
  });
});
