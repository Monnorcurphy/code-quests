import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'jest-axe';
import SkillsTab from '../skills-tab';
import type { Skill, MonsterType } from '@code-quests/shared';

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
    name: 'Auto: Goblin (Linter)',
    monsterTypeIds: ['mt-goblin'],
    status: 'candidate',
    createdBy: 'system',
    createdAt: '2024-01-01T00:00:00.000Z',
    hitCount: 3,
    implementation: '',
    ...overrides,
  };
}

function renderSkillsTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    ...render(
      <QueryClientProvider client={qc}>
        <SkillsTab />
      </QueryClientProvider>,
    ),
    qc,
  };
}

const { api } = await import('../../../lib/api');

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.mocked(api.monsters.listTypes).mockResolvedValue([makeMonsterType()]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('SkillsTab — empty states', () => {
  it('renders the candidates empty hint when no candidates exist', async () => {
    vi.mocked(api.skills.list).mockResolvedValue([]);
    renderSkillsTab();
    await waitFor(() => {
      expect(screen.getByText(/no skill candidates yet/i)).toBeDefined();
    });
  });

  it('renders the active skills empty hint when no active skills exist', async () => {
    vi.mocked(api.skills.list).mockResolvedValue([]);
    renderSkillsTab();
    await waitFor(() => {
      expect(screen.getByText(/no skills unlocked yet/i)).toBeDefined();
    });
  });

  it('renders both sections even when both are empty', async () => {
    vi.mocked(api.skills.list).mockResolvedValue([]);
    renderSkillsTab();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /skill candidates/i })).toBeDefined();
      expect(screen.getByRole('heading', { name: /unlocked skills/i })).toBeDefined();
    });
  });
});

describe('SkillsTab — candidate card', () => {
  it('renders a candidate card with Confirm Skill and Dismiss buttons', async () => {
    vi.mocked(api.skills.list).mockResolvedValue([makeSkill()]);
    renderSkillsTab();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirm skill: auto: goblin/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /dismiss skill: auto: goblin/i })).toBeDefined();
    });
  });

  it('shows monster type chip with type name', async () => {
    vi.mocked(api.skills.list).mockResolvedValue([makeSkill()]);
    renderSkillsTab();
    await waitFor(() => {
      expect(screen.getByText('Goblin (Linter)')).toBeDefined();
    });
  });

  it('shows hit count', async () => {
    vi.mocked(api.skills.list).mockResolvedValue([makeSkill({ hitCount: 5 })]);
    renderSkillsTab();
    await waitFor(() => {
      expect(screen.getByText(/detected 5 times/i)).toBeDefined();
    });
  });
});

describe('SkillsTab — confirm flow', () => {
  it('opens the inline confirm form when Confirm Skill is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    vi.mocked(api.skills.list).mockResolvedValue([makeSkill()]);
    renderSkillsTab();
    await waitFor(() => screen.getByRole('button', { name: /confirm skill/i }));
    await user.click(screen.getByRole('button', { name: /confirm skill/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^confirm$/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDefined();
    });
  });

  it('pre-fills the name input with the auto-generated skill name', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    vi.mocked(api.skills.list).mockResolvedValue([makeSkill()]);
    renderSkillsTab();
    await waitFor(() => screen.getByRole('button', { name: /confirm skill/i }));
    await user.click(screen.getByRole('button', { name: /confirm skill/i }));
    await waitFor(() => {
      const input = screen.getByLabelText(/skill name/i) as HTMLInputElement;
      expect(input.value).toBe('Auto: Goblin (Linter)');
    });
  });

  it('shows inline name error and does NOT call the API when name is empty', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    vi.mocked(api.skills.list).mockResolvedValue([makeSkill()]);
    renderSkillsTab();
    await waitFor(() => screen.getByRole('button', { name: /confirm skill/i }));
    await user.click(screen.getByRole('button', { name: /confirm skill/i }));
    await waitFor(() => screen.getByRole('button', { name: /^confirm$/i }));

    const nameInput = screen.getByLabelText(/skill name/i);
    await user.clear(nameInput);
    await user.click(screen.getByRole('button', { name: /^confirm$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/required/i)).toBeDefined();
    });
    expect(vi.mocked(api.skills.confirmCandidate)).not.toHaveBeenCalled();
  });

  it('Cancel closes the form without calling the API', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    vi.mocked(api.skills.list).mockResolvedValue([makeSkill()]);
    renderSkillsTab();
    await waitFor(() => screen.getByRole('button', { name: /confirm skill/i }));
    await user.click(screen.getByRole('button', { name: /confirm skill/i }));
    await waitFor(() => screen.getByRole('button', { name: /cancel/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirm skill/i })).toBeDefined();
    });
    expect(vi.mocked(api.skills.confirmCandidate)).not.toHaveBeenCalled();
  });

  it('calls confirmCandidate, shows success toast, then removes the card after 3s', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    vi.mocked(api.skills.list)
      .mockResolvedValueOnce([makeSkill()])
      .mockResolvedValue([]);
    vi.mocked(api.skills.confirmCandidate).mockResolvedValue(makeSkill({ status: 'active' }));

    renderSkillsTab();
    await waitFor(() => screen.getByRole('button', { name: /confirm skill/i }));
    await user.click(screen.getByRole('button', { name: /confirm skill/i }));
    await waitFor(() => screen.getByRole('button', { name: /^confirm$/i }));
    await user.click(screen.getByRole('button', { name: /^confirm$/i }));

    await waitFor(() => {
      expect(screen.getByText(/skill confirmed/i)).toBeDefined();
    });
    expect(vi.mocked(api.skills.confirmCandidate)).toHaveBeenCalledWith('skill-1', {
      name: 'Auto: Goblin (Linter)',
      implementation: '',
    });

    act(() => { vi.advanceTimersByTime(3000); });
    await waitFor(() => {
      expect(screen.queryByText(/skill confirmed/i)).toBeNull();
    });
  });
});

describe('SkillsTab — dismiss flow', () => {
  it('calls dismissCandidate and shows success toast, then removes the card after 3s', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    vi.mocked(api.skills.list)
      .mockResolvedValueOnce([makeSkill()])
      .mockResolvedValue([]);
    vi.mocked(api.skills.dismissCandidate).mockImplementation(() => Promise.resolve());

    renderSkillsTab();
    await waitFor(() => screen.getByRole('button', { name: /dismiss skill/i }));
    await user.click(screen.getByRole('button', { name: /dismiss skill/i }));

    await waitFor(() => {
      expect(screen.getByText(/skill dismissed/i)).toBeDefined();
    });
    expect(vi.mocked(api.skills.dismissCandidate)).toHaveBeenCalledWith('skill-1');

    act(() => { vi.advanceTimersByTime(3000); });
    await waitFor(() => {
      expect(screen.queryByText(/skill dismissed/i)).toBeNull();
    });
  });
});

describe('SkillsTab — active skills table', () => {
  it('renders active skills in the Unlocked Skills table', async () => {
    vi.mocked(api.skills.list).mockResolvedValue([
      makeSkill({ id: 'skill-2', name: 'Goblin Slayer', status: 'active', hitCount: 5 }),
    ]);
    renderSkillsTab();
    await waitFor(() => {
      expect(screen.getByText('Goblin Slayer')).toBeDefined();
    });
  });

  it('shows monster type chip for active skill', async () => {
    vi.mocked(api.skills.list).mockResolvedValue([
      makeSkill({ id: 'skill-2', name: 'Goblin Slayer', status: 'active' }),
    ]);
    renderSkillsTab();
    await waitFor(() => {
      expect(screen.getAllByText('Goblin (Linter)').length).toBeGreaterThan(0);
    });
  });

  it('calls api.skills.retire when Retire is clicked on an active skill', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    vi.mocked(api.skills.list).mockResolvedValue([
      makeSkill({ id: 'skill-2', name: 'Goblin Slayer', status: 'active' }),
    ]);
    vi.mocked(api.skills.retire).mockResolvedValue(makeSkill({ id: 'skill-2', status: 'retired' }));

    renderSkillsTab();
    await waitFor(() => screen.getByRole('button', { name: /retire skill: goblin slayer/i }));
    await user.click(screen.getByRole('button', { name: /retire skill: goblin slayer/i }));

    await waitFor(() => {
      expect(vi.mocked(api.skills.retire)).toHaveBeenCalledWith('skill-2');
    });
  });
});

describe('SkillsTab — accessibility', () => {
  it('has no axe violations when empty', async () => {
    vi.mocked(api.skills.list).mockResolvedValue([]);
    const { container } = renderSkillsTab();
    await waitFor(() => screen.getByText(/no skill candidates yet/i));
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations with a candidate card', async () => {
    vi.mocked(api.skills.list).mockResolvedValue([makeSkill()]);
    const { container } = renderSkillsTab();
    await waitFor(() => screen.getByRole('button', { name: /confirm skill/i }));
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations with an active skill', async () => {
    vi.mocked(api.skills.list).mockResolvedValue([
      makeSkill({ id: 'skill-2', name: 'Goblin Slayer', status: 'active' }),
    ]);
    const { container } = renderSkillsTab();
    await waitFor(() => screen.getByText('Goblin Slayer'));
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
