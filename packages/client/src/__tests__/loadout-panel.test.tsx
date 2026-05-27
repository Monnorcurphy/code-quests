import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoadoutPanel from '../features/armory/loadout-panel';
import { useTownStore } from '../stores/town-store';
import { api } from '../lib/api';
import type { Skill, Tool, MCPServer, Quest } from '@code-quests/shared';

vi.mock('../lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/api')>();
  return {
    ...original,
    api: {
      adventurers: { list: vi.fn().mockResolvedValue([]) },
      quests: {
        list: vi.fn().mockResolvedValue([]),
        get: vi.fn(),
        create: vi.fn(),
        patch: vi.fn(),
      },
      epics: { list: vi.fn().mockResolvedValue([]) },
      equipment: {
        skills: vi.fn().mockResolvedValue([]),
        tools: vi.fn().mockResolvedValue([]),
        mcpServers: vi.fn().mockResolvedValue([]),
      },
    },
  };
});

const mockSkills: Skill[] = [
  {
    id: 'linters_bane',
    name: "Linter's Bane",
    monsterTypeIds: [],
    status: 'active',
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    hitCount: 0,
    implementation: '',
  },
  {
    id: 'type_whisperer',
    name: 'Type Whisperer',
    monsterTypeIds: [],
    status: 'active',
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    hitCount: 0,
    implementation: '',
  },
];

const mockTools: Tool[] = [
  { id: 'pnpm', name: 'pnpm', description: 'Package manager', invocation: 'pnpm' },
];

const mockMcpServers: MCPServer[] = [
  { id: 'filesystem', name: 'Filesystem', config: {} },
];

const makeQuest = (overrides: Partial<Quest> = {}): Quest => ({
  id: 'q-1',
  epicId: null,
  title: 'Test Quest',
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
  currentScene: 'quest-forest' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

function renderPanel(props: { onClose?: () => void } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LoadoutPanel onClose={props.onClose ?? vi.fn()} />
    </QueryClientProvider>,
  );
}

describe('LoadoutPanel', () => {
  beforeEach(() => {
    useTownStore.setState({ selectedQuestId: 'q-1' });
    vi.mocked(api.equipment.skills).mockResolvedValue(mockSkills);
    vi.mocked(api.equipment.tools).mockResolvedValue(mockTools);
    vi.mocked(api.equipment.mcpServers).mockResolvedValue(mockMcpServers);
    vi.mocked(api.quests.list).mockResolvedValue([makeQuest()]);
    vi.mocked(api.quests.patch).mockResolvedValue(
      makeQuest({ equipment: { skillIds: ['linters_bane'], toolIds: [], mcpServerIds: [] } }),
    );
  });

  afterEach(() => {
    useTownStore.setState({ selectedQuestId: null });
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('renders three columns with correct headings', async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Skills' })).toBeDefined();
      expect(screen.getByRole('heading', { name: 'Tools' })).toBeDefined();
      expect(screen.getByRole('heading', { name: 'MCP Servers' })).toBeDefined();
    });
  });

  it('renders catalog items from the API', async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.getByLabelText("Linter's Bane")).toBeDefined();
      expect(screen.getByLabelText('pnpm')).toBeDefined();
      expect(screen.getByLabelText('Filesystem')).toBeDefined();
    });
  });

  it('toggles a skill checkbox and calls patch mutation with correct payload', async () => {
    const user = userEvent.setup();
    renderPanel();

    await waitFor(() => {
      expect(screen.getByLabelText("Linter's Bane")).toBeDefined();
    });

    await user.click(screen.getByLabelText("Linter's Bane"));
    await user.click(screen.getByRole('button', { name: 'Save Loadout' }));

    await waitFor(() => {
      expect(vi.mocked(api.quests.patch)).toHaveBeenCalledWith('q-1', {
        equipment: { skillIds: ['linters_bane'], toolIds: [], mcpServerIds: [] },
      });
    });
  });

  it('shows success status announced via aria-live after save', async () => {
    const user = userEvent.setup();
    renderPanel();

    await waitFor(() => screen.getByRole('button', { name: 'Save Loadout' }));
    await user.click(screen.getByRole('button', { name: 'Save Loadout' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeDefined();
    });
    expect(screen.getByText('Loadout saved!')).toBeDefined();
  });

  it('success message auto-dismisses after 3 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPanel();

    await waitFor(() => screen.getByRole('button', { name: 'Save Loadout' }));
    await user.click(screen.getByRole('button', { name: 'Save Loadout' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeDefined();
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull();
    });
  });

  it('shows persistent error when save mutation fails', async () => {
    vi.mocked(api.quests.patch).mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    renderPanel();

    await waitFor(() => screen.getByRole('button', { name: 'Save Loadout' }));
    await user.click(screen.getByRole('button', { name: 'Save Loadout' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
    expect(screen.getByText('Server error')).toBeDefined();
  });

  it('error message does not auto-dismiss', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(api.quests.patch).mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPanel();

    await waitFor(() => screen.getByRole('button', { name: 'Save Loadout' }));
    await user.click(screen.getByRole('button', { name: 'Save Loadout' }));

    await waitFor(() => expect(screen.getByText('Network error')).toBeDefined());

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText('Network error')).toBeDefined();
  });

  it('shows message when no quest is selected', () => {
    useTownStore.setState({ selectedQuestId: null });
    renderPanel();

    expect(screen.getByText(/No quest selected/)).toBeDefined();
  });

  it('pre-populates checkboxes from existing quest equipment', async () => {
    vi.mocked(api.quests.list).mockResolvedValue([
      makeQuest({ equipment: { skillIds: ['linters_bane'], toolIds: [], mcpServerIds: [] } }),
    ]);
    renderPanel();

    await waitFor(() => {
      const checkbox = screen.getByLabelText("Linter's Bane") as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });
  });

  it('calls onClose when Close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderPanel({ onClose });

    await waitFor(() => screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('moves focus inside the panel on mount', () => {
    renderPanel();
    const inner = document.querySelector('.modal-panel') as HTMLElement;
    expect(inner.contains(document.activeElement)).toBe(true);
  });

  it('disables Save button while saving', async () => {
    vi.mocked(api.quests.patch).mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderPanel();

    await waitFor(() => screen.getByRole('button', { name: 'Save Loadout' }));
    await user.click(screen.getByRole('button', { name: 'Save Loadout' }));

    const savingBtn = screen.getByRole('button', { name: 'Saving…' });
    expect(savingBtn).toBeDefined();
    expect((savingBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
