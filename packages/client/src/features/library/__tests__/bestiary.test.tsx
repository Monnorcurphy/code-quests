import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'jest-axe';
import Bestiary from '../bestiary';
import type { Monster, MonsterType, MonsterEncounter } from '@code-quests/shared';

vi.mock('../../../lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../lib/api')>();
  return {
    ...original,
    api: {
      ...original.api,
      monsters: {
        list: vi.fn(),
        listTypes: vi.fn(),
        get: vi.fn(),
        listEncounters: vi.fn(),
        listQuestEncounters: vi.fn(),
      },
      quests: {
        ...original.api.quests,
        get: vi.fn(),
      },
    },
  };
});

function makeMonsterType(overrides: Partial<MonsterType> = {}): MonsterType {
  return {
    id: 'mt-1',
    name: 'Goblin Linter',
    spritePath: '/assets/monsters/goblin.png',
    defaultDifficulty: 2,
    failureSignature: 'lint errors',
    createdBy: 'system',
    ...overrides,
  };
}

function makeMonster(overrides: Partial<Monster> = {}): Monster {
  return {
    id: 'mon-1',
    typeId: 'mt-1',
    name: 'Grizzlebar the Nit',
    scope: 'project',
    projectId: 'proj-1',
    firstSeenAt: '2024-01-01T00:00:00.000Z',
    lastSeenAt: '2024-06-15T00:00:00.000Z',
    encounters: 5,
    defeats: 3,
    escapes: 2,
    calibratedDifficulty: 3,
    notes: '',
    ...overrides,
  };
}

function makeEncounter(overrides: Partial<MonsterEncounter> = {}): MonsterEncounter {
  return {
    id: 'enc-1',
    monsterId: 'mon-1',
    questId: 'quest-1',
    appearedAt: '2024-06-15T10:00:00.000Z',
    combatLog: ['goblin attacks', 'hero defends'],
    outcome: 'victory',
    loot: [],
    ...overrides,
  };
}

function renderBestiary() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Bestiary />
    </QueryClientProvider>,
  );
}

const { api } = await import('../../../lib/api');

beforeEach(() => {
  vi.mocked(api.monsters.listTypes).mockResolvedValue([makeMonsterType()]);
});

describe('Bestiary — empty state', () => {
  it('shows the empty state when no monsters exist', async () => {
    vi.mocked(api.monsters.list).mockResolvedValue([]);
    renderBestiary();
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeDefined();
      expect(screen.getByText(/no monsters encountered yet/i)).toBeDefined();
    });
  });

  it('empty state includes a next-step hint', async () => {
    vi.mocked(api.monsters.list).mockResolvedValue([]);
    renderBestiary();
    await waitFor(() => {
      expect(screen.getByText(/run a quest in the town square/i)).toBeDefined();
    });
  });
});

describe('Bestiary — table', () => {
  it('renders a row for each monster', async () => {
    vi.mocked(api.monsters.list).mockResolvedValue([
      makeMonster({ id: 'mon-1', name: 'Grizzlebar' }),
      makeMonster({ id: 'mon-2', name: 'Shadowcache' }),
    ]);
    renderBestiary();
    await waitFor(() => {
      expect(screen.getByText('Grizzlebar')).toBeDefined();
      expect(screen.getByText('Shadowcache')).toBeDefined();
    });
  });

  it('renders monster type name from the types list', async () => {
    vi.mocked(api.monsters.list).mockResolvedValue([makeMonster()]);
    renderBestiary();
    await waitFor(() => {
      expect(screen.getByText('Goblin Linter')).toBeDefined();
    });
  });

  it('renders difficulty stars with correct aria-label', async () => {
    vi.mocked(api.monsters.list).mockResolvedValue([makeMonster({ calibratedDifficulty: 3 })]);
    renderBestiary();
    await waitFor(() => {
      const stars = screen.getByLabelText('3 of 5 stars');
      expect(stars.textContent).toBe('★★★☆☆');
    });
  });

  it('renders encounter count', async () => {
    vi.mocked(api.monsters.list).mockResolvedValue([makeMonster({ encounters: 7 })]);
    renderBestiary();
    await waitFor(() => {
      const row = screen.getByRole('row', { name: /view details/i });
      expect(within(row).getByText('7')).toBeDefined();
    });
  });

  it('shows sortable column headers with aria-sort', async () => {
    vi.mocked(api.monsters.list).mockResolvedValue([makeMonster()]);
    renderBestiary();
    await waitFor(() => {
      const nameCol = screen.getByRole('columnheader', { name: 'Name' });
      expect(nameCol.getAttribute('aria-sort')).toBe('none');
    });
  });
});

describe('Bestiary — sorting', () => {
  it('sorts by name ascending when Name header is clicked twice', async () => {
    const user = userEvent.setup();
    vi.mocked(api.monsters.list).mockResolvedValue([
      makeMonster({ id: 'mon-2', name: 'Zebra Bug' }),
      makeMonster({ id: 'mon-1', name: 'Alpha Bug' }),
    ]);
    renderBestiary();
    await waitFor(() => screen.getByText('Zebra Bug'));

    const nameBtn = screen.getByRole('button', { name: /^name/i });
    await user.click(nameBtn); // desc first
    await user.click(nameBtn); // then asc
    await waitFor(() => {
      const colHeader = screen.getByRole('columnheader', { name: 'Name' });
      expect(colHeader.getAttribute('aria-sort')).toBe('ascending');
    });
  });
});

describe('Bestiary — detail panel', () => {
  it('opens the detail panel when a row is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(api.monsters.list).mockResolvedValue([makeMonster({ name: 'Grizzlebar' })]);
    vi.mocked(api.monsters.listEncounters).mockResolvedValue([makeEncounter()]);
    vi.mocked(api.quests.get).mockResolvedValue({
      id: 'quest-1', title: 'Fix the Linter', description: '', acceptanceCriteria: [],
      edgeCases: [], context: '', status: 'complete', adventurerId: null, agentId: null,
      equipment: { skillIds: [], toolIds: [], mcpServerIds: [] }, specAudit: null,
      failureSummary: null, currentScene: 'quest-forest', createdAt: '', updatedAt: '',
    } as never);
    renderBestiary();
    await waitFor(() => screen.getByText('Grizzlebar'));
    await user.click(screen.getByRole('row', { name: /grizzlebar/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /back to bestiary/i })).toBeDefined();
    });
  });

  it('returns to the table when Back is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(api.monsters.list).mockResolvedValue([makeMonster({ name: 'Grizzlebar' })]);
    vi.mocked(api.monsters.listEncounters).mockResolvedValue([]);
    renderBestiary();
    await waitFor(() => screen.getByText('Grizzlebar'));
    await user.click(screen.getByRole('row', { name: /grizzlebar/i }));
    await waitFor(() => screen.getByRole('button', { name: /back to bestiary/i }));
    await user.click(screen.getByRole('button', { name: /back to bestiary/i }));
    await waitFor(() => {
      expect(screen.getByText('Grizzlebar')).toBeDefined();
      expect(screen.queryByRole('button', { name: /back to bestiary/i })).toBeNull();
    });
  });
});

describe('Bestiary — error state', () => {
  it('shows error message with retry button when fetch fails', async () => {
    vi.mocked(api.monsters.list).mockRejectedValue(new Error('Network error'));
    renderBestiary();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByRole('button', { name: /retry/i })).toBeDefined();
    });
  });
});

describe('Bestiary — loading state', () => {
  it('shows loading announcement via aria-live', () => {
    vi.mocked(api.monsters.list).mockReturnValue(new Promise(() => {}));
    renderBestiary();
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion?.textContent).toContain('Loading bestiary');
  });
});

describe('Bestiary — scope filter tabs', () => {
  it('shows Mine (Project) and Nemeses (Guild) tabs', async () => {
    vi.mocked(api.monsters.list).mockResolvedValue([]);
    renderBestiary();
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /mine.*project/i })).toBeDefined();
      expect(screen.getByRole('tab', { name: /nemeses.*guild/i })).toBeDefined();
    });
  });

  it('Mine tab is selected by default', async () => {
    vi.mocked(api.monsters.list).mockResolvedValue([]);
    renderBestiary();
    await waitFor(() => {
      const mineTab = screen.getByRole('tab', { name: /mine.*project/i });
      expect(mineTab.getAttribute('aria-selected')).toBe('true');
    });
  });

  it('switching to Nemeses tab queries for guild scope', async () => {
    const user = userEvent.setup();
    vi.mocked(api.monsters.list).mockResolvedValue([]);
    renderBestiary();
    await waitFor(() => screen.getByRole('tab', { name: /nemeses.*guild/i }));
    await user.click(screen.getByRole('tab', { name: /nemeses.*guild/i }));
    await waitFor(() => {
      const guildTab = screen.getByRole('tab', { name: /nemeses.*guild/i });
      expect(guildTab.getAttribute('aria-selected')).toBe('true');
    });
    // The api.monsters.list should have been called with scope: 'guild'
    expect(vi.mocked(api.monsters.list)).toHaveBeenCalledWith({ scope: 'guild' });
  });

  it('shows guild empty state with hint when Nemeses tab is active and empty', async () => {
    const user = userEvent.setup();
    vi.mocked(api.monsters.list).mockResolvedValue([]);
    renderBestiary();
    await waitFor(() => screen.getByRole('tab', { name: /nemeses.*guild/i }));
    await user.click(screen.getByRole('tab', { name: /nemeses.*guild/i }));
    await waitFor(() => {
      expect(screen.getByText(/no guild nemeses yet/i)).toBeDefined();
    });
  });
});

describe('Bestiary — accessibility', () => {
  it('has no axe violations when empty', async () => {
    vi.mocked(api.monsters.list).mockResolvedValue([]);
    const { container } = renderBestiary();
    await waitFor(() => screen.getByText(/no monsters encountered yet/i));
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations with monsters loaded', async () => {
    vi.mocked(api.monsters.list).mockResolvedValue([makeMonster()]);
    const { container } = renderBestiary();
    await waitFor(() => screen.getByText('Grizzlebar the Nit'));
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
