import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { axe } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CoinMonsterTypeModal from '../coin-monster-type-modal';
import { MONSTER_SPRITE_OPTIONS } from '../../../assets/monster-sprites-manifest';
import type { MonsterType } from '@code-quests/shared';

vi.mock('../../../lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../lib/api')>();
  return {
    ...original,
    api: {
      ...original.api,
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
    id: 'user:test-type',
    name: 'Test Type',
    spritePath: '/assets/monsters/goblin.png',
    defaultDifficulty: 2,
    failureSignature: 'test.*error',
    createdBy: 'user',
    ...overrides,
  };
}

const mockOnClose = vi.fn();
const mockOnSuccess = vi.fn();
const mockTriggerRef = { current: null } as React.RefObject<HTMLButtonElement>;

function renderModal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    ...render(
      <QueryClientProvider client={qc}>
        <CoinMonsterTypeModal
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
  mockOnClose.mockClear();
  mockOnSuccess.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('CoinMonsterTypeModal — rendering', () => {
  it('renders the modal dialog with title', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('heading', { name: /coin new monster type/i })).toBeDefined();
  });

  it('renders all required fields', () => {
    renderModal();
    expect(screen.getByLabelText(/^name/i)).toBeDefined();
    expect(screen.getByLabelText(/failure signature/i)).toBeDefined();
    expect(screen.getByLabelText(/default difficulty/i)).toBeDefined();
  });

  it('renders sprite thumbnails from the manifest', () => {
    renderModal();
    for (const opt of MONSTER_SPRITE_OPTIONS) {
      expect(screen.getByRole('button', { name: opt.label })).toBeDefined();
    }
  });
});

describe('CoinMonsterTypeModal — submit disabled until all fields valid', () => {
  it('submit is disabled initially', () => {
    renderModal();
    const submitBtn = screen.getByRole('button', { name: /coin monster type/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('submit is disabled with only name filled', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderModal();
    await user.type(screen.getByLabelText(/^name/i), 'Lint Goblin');
    const submitBtn = screen.getByRole('button', { name: /coin monster type/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('submit is disabled with name + sprite but no signature', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderModal();
    await user.type(screen.getByLabelText(/^name/i), 'Lint Goblin');
    await user.click(screen.getByRole('button', { name: MONSTER_SPRITE_OPTIONS[0].label }));
    const submitBtn = screen.getByRole('button', { name: /coin monster type/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('submit is disabled with an invalid regex signature', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderModal();
    await user.type(screen.getByLabelText(/^name/i), 'Lint Goblin');
    await user.click(screen.getByRole('button', { name: MONSTER_SPRITE_OPTIONS[0].label }));
    await user.type(screen.getByLabelText(/failure signature/i), '***');
    const submitBtn = screen.getByRole('button', { name: /coin monster type/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('submit is enabled when all required fields are valid', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderModal();
    await user.type(screen.getByLabelText(/^name/i), 'Lint Goblin');
    await user.click(screen.getByRole('button', { name: MONSTER_SPRITE_OPTIONS[0].label }));
    await user.type(screen.getByLabelText(/failure signature/i), 'eslint.*no-unused');
    const submitBtn = screen.getByRole('button', { name: /coin monster type/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('CoinMonsterTypeModal — invalid regex inline error', () => {
  it('shows inline error when failure signature is an invalid regex', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderModal();
    const sigInput = screen.getByLabelText(/failure signature/i);
    await user.type(sigInput, '***');
    await waitFor(() => {
      expect(screen.getByText(/must be a valid regular expression/i)).toBeDefined();
    });
  });

  it('clears the regex error when a valid regex is entered', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderModal();
    const sigInput = screen.getByLabelText(/failure signature/i);
    await user.type(sigInput, '***');
    await waitFor(() => screen.getByText(/must be a valid regular expression/i));
    await user.clear(sigInput);
    await user.type(sigInput, 'eslint.*error');
    await waitFor(() => {
      expect(screen.queryByText(/must be a valid regular expression/i)).toBeNull();
    });
  });
});

describe('CoinMonsterTypeModal — sprite picker keyboard navigation', () => {
  it('no sprite is selected initially (all aria-pressed=false)', () => {
    renderModal();
    const sprites = MONSTER_SPRITE_OPTIONS.map((opt) =>
      screen.getByRole('button', { name: opt.label }),
    );
    sprites.forEach((btn) => {
      expect(btn.getAttribute('aria-pressed')).toBe('false');
    });
  });

  it('clicking a sprite selects it (aria-pressed=true)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderModal();
    const dragonBtn = screen.getByRole('button', { name: 'Dragon' });
    await user.click(dragonBtn);
    expect(dragonBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('ArrowRight moves selection to the next sprite', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderModal();
    const dragonBtn = screen.getByRole('button', { name: 'Dragon' });
    const goblinBtn = screen.getByRole('button', { name: 'Goblin' });
    await user.click(dragonBtn);
    expect(dragonBtn.getAttribute('aria-pressed')).toBe('true');
    await user.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(dragonBtn.getAttribute('aria-pressed')).toBe('false');
      expect(goblinBtn.getAttribute('aria-pressed')).toBe('true');
    });
  });

  it('Enter on a focused sprite button confirms the selection', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderModal();
    // Tab from Cancel → Name → first sprite (Dragon has tabIndex=0 initially)
    await user.tab();
    await user.tab();
    await user.keyboard('{Enter}');
    await waitFor(() => {
      const dragonBtn = screen.getByRole('button', { name: 'Dragon' });
      expect(dragonBtn.getAttribute('aria-pressed')).toBe('true');
    });
  });

  it('ArrowLeft wraps around from first to last sprite', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderModal();
    const dragonBtn = screen.getByRole('button', { name: 'Dragon' });
    const lastSprite = MONSTER_SPRITE_OPTIONS[MONSTER_SPRITE_OPTIONS.length - 1];
    const lastBtn = screen.getByRole('button', { name: lastSprite.label });
    await user.click(dragonBtn);
    await user.keyboard('{ArrowLeft}');
    await waitFor(() => {
      expect(dragonBtn.getAttribute('aria-pressed')).toBe('false');
      expect(lastBtn.getAttribute('aria-pressed')).toBe('true');
    });
  });
});

describe('CoinMonsterTypeModal — 409 duplicate name error', () => {
  it('shows inline name error when server returns 409', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    const conflictError = Object.assign(new Error('A type with this name already exists.'), {
      status: 409,
    });
    vi.mocked(api.monsters.createType).mockRejectedValue(conflictError);

    renderModal();
    await user.type(screen.getByLabelText(/^name/i), 'Duplicate Type');
    await user.click(screen.getByRole('button', { name: MONSTER_SPRITE_OPTIONS[0].label }));
    await user.type(screen.getByLabelText(/failure signature/i), 'test.*pattern');
    await user.click(screen.getByRole('button', { name: /coin monster type/i }));

    await waitFor(() => {
      expect(screen.getByText(/a type with this name already exists/i)).toBeDefined();
    });
  });

  it('shows inline name error when server returns field: name error', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    const fieldError = Object.assign(new Error('Name is taken.'), { field: 'name' });
    vi.mocked(api.monsters.createType).mockRejectedValue(fieldError);

    renderModal();
    await user.type(screen.getByLabelText(/^name/i), 'Taken Name');
    await user.click(screen.getByRole('button', { name: MONSTER_SPRITE_OPTIONS[0].label }));
    await user.type(screen.getByLabelText(/failure signature/i), 'test.*pattern');
    await user.click(screen.getByRole('button', { name: /coin monster type/i }));

    await waitFor(() => {
      expect(screen.getByText(/name is taken/i)).toBeDefined();
    });
  });
});

describe('CoinMonsterTypeModal — happy path', () => {
  it('calls api.monsters.createType with correct payload and invalidates queries', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    const createdType = makeMonsterType({ id: 'user:lint-goblin', name: 'Lint Goblin' });
    vi.mocked(api.monsters.createType).mockResolvedValue(createdType);

    const { qc } = renderModal();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    await user.type(screen.getByLabelText(/^name/i), 'Lint Goblin');
    await user.click(screen.getByRole('button', { name: MONSTER_SPRITE_OPTIONS[0].label }));
    await user.type(screen.getByLabelText(/failure signature/i), 'eslint.*no-unused');
    await user.click(screen.getByRole('button', { name: /coin monster type/i }));

    await waitFor(() => {
      expect(vi.mocked(api.monsters.createType)).toHaveBeenCalledWith({
        name: 'Lint Goblin',
        spritePath: MONSTER_SPRITE_OPTIONS[0].path,
        defaultDifficulty: 1,
        failureSignature: 'eslint.*no-unused',
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['monster-types'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['monsters'] });
    });
  });

  it('shows success toast with type name and id', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    const createdType = makeMonsterType({ id: 'user:lint-goblin', name: 'Lint Goblin' });
    vi.mocked(api.monsters.createType).mockResolvedValue(createdType);

    renderModal();
    await user.type(screen.getByLabelText(/^name/i), 'Lint Goblin');
    await user.click(screen.getByRole('button', { name: MONSTER_SPRITE_OPTIONS[0].label }));
    await user.type(screen.getByLabelText(/failure signature/i), 'eslint.*no-unused');
    await user.click(screen.getByRole('button', { name: /coin monster type/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeDefined();
      expect(screen.getByText(/lint goblin.*coined/i)).toBeDefined();
      expect(screen.getByText(/user:lint-goblin/i)).toBeDefined();
    });
  });

  it('closes modal and calls onSuccess after 3 seconds', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    vi.mocked(api.monsters.createType).mockResolvedValue(
      makeMonsterType({ id: 'user:lint-goblin', name: 'Lint Goblin' }),
    );

    renderModal();
    await user.type(screen.getByLabelText(/^name/i), 'Lint Goblin');
    await user.click(screen.getByRole('button', { name: MONSTER_SPRITE_OPTIONS[0].label }));
    await user.type(screen.getByLabelText(/failure signature/i), 'eslint.*no-unused');
    await user.click(screen.getByRole('button', { name: /coin monster type/i }));

    await waitFor(() => screen.getByRole('status'));

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith('Lint Goblin');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});

describe('CoinMonsterTypeModal — dismiss', () => {
  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderModal();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    renderModal();
    const backdrop = screen.getByRole('dialog');
    await user.click(backdrop);
    expect(mockOnClose).toHaveBeenCalled();
  });
});

describe('CoinMonsterTypeModal — success timer cleanup on unmount', () => {
  it('does not call onSuccess if modal is unmounted before 3s elapse', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    vi.mocked(api.monsters.createType).mockResolvedValue(
      makeMonsterType({ id: 'user:lint-goblin', name: 'Lint Goblin' }),
    );

    const { unmount } = renderModal();
    await user.type(screen.getByLabelText(/^name/i), 'Lint Goblin');
    await user.click(screen.getByRole('button', { name: MONSTER_SPRITE_OPTIONS[0].label }));
    await user.type(screen.getByLabelText(/failure signature/i), 'eslint.*no-unused');
    await user.click(screen.getByRole('button', { name: /coin monster type/i }));

    await waitFor(() => screen.getByRole('status'));

    unmount();

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
  });
});

describe('CoinMonsterTypeModal — accessibility', () => {
  it('has no axe violations in initial state', async () => {
    const { container } = renderModal();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations when an inline regex error is shown', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    const { container } = renderModal();
    await user.type(screen.getByLabelText(/failure signature/i), '***');
    await waitFor(() => screen.getByText(/must be a valid regular expression/i));
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
