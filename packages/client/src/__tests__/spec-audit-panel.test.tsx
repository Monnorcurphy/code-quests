import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SpecAuditPanel from '../features/quests/spec-audit-panel';
import { useTownStore } from '../stores/town-store';
import type { Quest, SpecAudit } from '@code-quests/shared';

const mockGoToBuilding = vi.fn();

function makeQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 'q-1',
    epicId: null,
    projectId: null,
    modelId: null,
    title: 'Test Quest',
    description: 'A sufficiently long description for testing purposes here',
    acceptanceCriteria: ['AC one'],
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
    ...overrides,
  };
}

function makeAudit(overrides: Partial<SpecAudit> = {}): SpecAudit {
  return {
    runAt: new Date().toISOString(),
    gaps: [],
    bypassed: false,
    ...overrides,
  };
}

function renderPanel(quest: Quest, props: Partial<Parameters<typeof SpecAuditPanel>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const merged = {
    quest,
    onRunAudit: vi.fn(),
    isRunning: false,
    runError: null,
    runSuccess: false,
    ...props,
  };
  return render(
    <QueryClientProvider client={queryClient}>
      <SpecAuditPanel {...merged} />
    </QueryClientProvider>,
  );
}

describe('SpecAuditPanel', () => {
  beforeEach(() => {
    useTownStore.setState({ goToBuilding: mockGoToBuilding });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows "audit not yet run" when specAudit is null', () => {
    renderPanel(makeQuest({ specAudit: null }));
    expect(screen.getByText(/audit not yet run/i)).toBeDefined();
  });

  it('shows "all checks pass" when gaps are empty', () => {
    const quest = makeQuest({ specAudit: makeAudit({ gaps: [] }) });
    renderPanel(quest);
    expect(screen.getByText(/all checks pass/i)).toBeDefined();
  });

  it('renders gap chips when audit has gaps', () => {
    const quest = makeQuest({
      specAudit: makeAudit({
        gaps: [
          { building: 'oracle', reason: 'Acceptance criteria are missing', severity: 'block' },
          { building: 'tavern', reason: 'No edge cases recorded', severity: 'warn' },
        ],
      }),
    });
    renderPanel(quest);
    expect(screen.getByText('Acceptance criteria are missing')).toBeDefined();
    expect(screen.getByText('No edge cases recorded')).toBeDefined();
  });

  it('renders BLOCKING label for block-severity gap', () => {
    const quest = makeQuest({
      specAudit: makeAudit({
        gaps: [
          { building: 'oracle', reason: 'ACs missing', severity: 'block' },
        ],
      }),
    });
    renderPanel(quest);
    expect(screen.getByText('BLOCKING')).toBeDefined();
  });

  it('does not render BLOCKING label for warn-severity gap', () => {
    const quest = makeQuest({
      specAudit: makeAudit({
        gaps: [
          { building: 'tavern', reason: 'No edge cases', severity: 'warn' },
        ],
      }),
    });
    renderPanel(quest);
    expect(screen.queryByText('BLOCKING')).toBeNull();
  });

  it('calls goToBuilding with correct building slug when chip is clicked', async () => {
    const user = userEvent.setup();
    const quest = makeQuest({
      specAudit: makeAudit({
        gaps: [
          { building: 'oracle', reason: 'Acceptance criteria are missing', severity: 'block' },
        ],
      }),
    });
    renderPanel(quest);

    const btn = screen.getByRole('button', { name: /go to oracle/i });
    await user.click(btn);

    expect(mockGoToBuilding).toHaveBeenCalledWith('oracle');
  });

  it('calls goToBuilding with correct slug for different building', async () => {
    const user = userEvent.setup();
    const quest = makeQuest({
      specAudit: makeAudit({
        gaps: [
          { building: 'tavern', reason: 'No edge cases recorded', severity: 'warn' },
        ],
      }),
    });
    renderPanel(quest);

    const btn = screen.getByRole('button', { name: /go to tavern/i });
    await user.click(btn);

    expect(mockGoToBuilding).toHaveBeenCalledWith('tavern');
  });

  it('chips have aria-labels that include the gap reason', () => {
    const quest = makeQuest({
      specAudit: makeAudit({
        gaps: [
          { building: 'armory', reason: 'No equipment selected', severity: 'warn' },
        ],
      }),
    });
    renderPanel(quest);

    const btn = screen.getByRole('button', { name: /no equipment selected/i });
    expect(btn).toBeDefined();
  });

  it('shows "Run audit" button', () => {
    renderPanel(makeQuest());
    expect(screen.getByRole('button', { name: /run audit/i })).toBeDefined();
  });

  it('disables "Run audit" and shows running text when isRunning is true', () => {
    renderPanel(makeQuest(), { isRunning: true });
    const btn = screen.getByRole('button', { name: /running audit/i });
    expect(btn).toBeDefined();
    // The button is disabled when running
    expect(btn.hasAttribute('disabled')).toBe(true);
  });

  it('calls onRunAudit when button is clicked', async () => {
    const user = userEvent.setup();
    const onRunAudit = vi.fn();
    renderPanel(makeQuest(), { onRunAudit });
    await user.click(screen.getByRole('button', { name: /run audit/i }));
    expect(onRunAudit).toHaveBeenCalledOnce();
  });

  it('shows error message when runError is set', () => {
    renderPanel(makeQuest(), { runError: 'Failed to connect to server' });
    expect(screen.getByText('Failed to connect to server')).toBeDefined();
  });

  it('shows success message when runSuccess is true', () => {
    renderPanel(makeQuest(), { runSuccess: true });
    expect(screen.getByText(/audit complete/i)).toBeDefined();
  });
});
