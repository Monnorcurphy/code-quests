import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import PartyMap from '../party-map';
import { api } from '../../../lib/api';
import { useQuestStore } from '../../../stores/quest-store';
import type { Quest } from '@code-quests/shared';

vi.mock('../../../lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../lib/api')>();
  return {
    ...original,
    api: {
      ...original.api,
      quests: {
        ...original.api.quests,
        active: vi.fn(),
      },
      adventurers: {
        ...original.api.adventurers,
        get: vi.fn(),
      },
    },
  };
});

vi.mock('react-router-dom', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...original,
    useNavigate: () => mockNavigate,
  };
});

const mockNavigate = vi.fn();

function makeQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 'q-1',
    epicId: null,
    projectId: null,
    title: 'Slay the Shadow',
    description: '',
    acceptanceCriteria: [],
    edgeCases: [],
    context: '',
    status: 'active',
    adventurerId: 'adv-1',
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

function renderPartyMap() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PartyMap />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockNavigate.mockReset();
  useQuestStore.setState({
    _nextId: 0,
    entriesByQuest: {},
    currentSceneByQuest: {},
    statusByQuest: {},
  });
  vi.mocked(api.adventurers.get).mockResolvedValue({
    id: 'adv-1',
    name: 'Thorin',
    class: 'champion' as const,
    modelId: 'claude-opus-4-7',
    createdAt: new Date().toISOString(),
    stats: {},
    specializations: [],
    scars: [],
  });
});

describe('PartyMap', () => {
  it('renders the collapsed banner by default', async () => {
    vi.mocked(api.quests.active).mockResolvedValue([]);
    renderPartyMap();
    const banner = screen.getByRole('button', { name: /party map/i });
    expect(banner).toBeDefined();
    expect(banner.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows "No quests" in the banner when no active quests', async () => {
    vi.mocked(api.quests.active).mockResolvedValue([]);
    renderPartyMap();
    await waitFor(() => {
      expect(screen.getByText(/⚔ No quests/)).toBeDefined();
    });
  });

  it('shows count in banner when there are active quests', async () => {
    vi.mocked(api.quests.active).mockResolvedValue([makeQuest()]);
    renderPartyMap();
    await waitFor(() => {
      expect(screen.getByText(/⚔ 1 active/)).toBeDefined();
    });
  });

  it('renders empty state when expanded and no active quests', async () => {
    const user = userEvent.setup();
    vi.mocked(api.quests.active).mockResolvedValue([]);
    renderPartyMap();
    await waitFor(() => {
      expect(screen.getByText(/⚔ No quests/)).toBeDefined();
    });
    const banner = screen.getByRole('button', { name: /party map/i });
    await user.click(banner);
    await waitFor(() => {
      expect(screen.getByText(/No active quests/)).toBeDefined();
    });
  });

  it('renders quest rows when expanded with active quests', async () => {
    const user = userEvent.setup();
    vi.mocked(api.quests.active).mockResolvedValue([
      makeQuest({ id: 'q-1', adventurerId: 'adv-1' }),
    ]);
    renderPartyMap();
    const banner = screen.getByRole('button', { name: /party map/i });
    await user.click(banner);
    await waitFor(() => {
      expect(screen.getByText('Forest path')).toBeDefined();
    });
  });

  it('shows adventurer name in rows', async () => {
    const user = userEvent.setup();
    vi.mocked(api.quests.active).mockResolvedValue([makeQuest({ adventurerId: 'adv-1' })]);
    renderPartyMap();
    const banner = screen.getByRole('button', { name: /party map/i });
    await user.click(banner);
    await waitFor(() => {
      expect(screen.getByText('Thorin')).toBeDefined();
    });
  });

  it('clicking a row navigates to the quest route', async () => {
    const user = userEvent.setup();
    vi.mocked(api.quests.active).mockResolvedValue([makeQuest({ id: 'q-42' })]);
    renderPartyMap();
    const banner = screen.getByRole('button', { name: /party map/i });
    await user.click(banner);
    await waitFor(() => {
      expect(screen.getByText('Forest path')).toBeDefined();
    });
    const row = screen.getByRole('button', { name: /go to quest/i });
    await user.click(row);
    expect(mockNavigate).toHaveBeenCalledWith('/quest/q-42');
  });

  it('toggles expanded/collapsed via click', async () => {
    const user = userEvent.setup();
    vi.mocked(api.quests.active).mockResolvedValue([]);
    renderPartyMap();
    await waitFor(() => {
      expect(screen.getByText(/⚔ No quests/)).toBeDefined();
    });
    const banner = screen.getByRole('button', { name: /party map/i });
    expect(banner.getAttribute('aria-expanded')).toBe('false');
    await user.click(banner);
    expect(banner.getAttribute('aria-expanded')).toBe('true');
    await user.click(banner);
    expect(banner.getAttribute('aria-expanded')).toBe('false');
  });

  it('toggles expanded/collapsed via Enter key', async () => {
    const user = userEvent.setup();
    vi.mocked(api.quests.active).mockResolvedValue([]);
    renderPartyMap();
    await waitFor(() => {
      expect(screen.getByText(/⚔ No quests/)).toBeDefined();
    });
    const banner = screen.getByRole('button', { name: /party map/i });
    banner.focus();
    expect(banner.getAttribute('aria-expanded')).toBe('false');
    await user.keyboard('{Enter}');
    expect(banner.getAttribute('aria-expanded')).toBe('true');
    await user.keyboard('{Enter}');
    expect(banner.getAttribute('aria-expanded')).toBe('false');
  });

  it('collapses on Escape key', async () => {
    const user = userEvent.setup();
    vi.mocked(api.quests.active).mockResolvedValue([]);
    renderPartyMap();
    await waitFor(() => {
      expect(screen.getByText(/⚔ No quests/)).toBeDefined();
    });
    const banner = screen.getByRole('button', { name: /party map/i });
    await user.click(banner);
    expect(banner.getAttribute('aria-expanded')).toBe('true');
    await user.keyboard('{Escape}');
    expect(banner.getAttribute('aria-expanded')).toBe('false');
  });

  it('limits displayed rows to 8', async () => {
    const user = userEvent.setup();
    const quests = Array.from({ length: 10 }, (_, i) =>
      makeQuest({ id: `q-${i}`, adventurerId: null }),
    );
    vi.mocked(api.quests.active).mockResolvedValue(quests);
    renderPartyMap();
    const banner = screen.getByRole('button', { name: /party map/i });
    await user.click(banner);
    await waitFor(() => {
      const rows = screen.getAllByRole('button', { name: /go to quest/i });
      expect(rows).toHaveLength(8);
    });
  });

  it('renders party-map with pointer-events none on wrapper', () => {
    vi.mocked(api.quests.active).mockResolvedValue([]);
    renderPartyMap();
    const wrapper = screen.getByTestId('party-map');
    expect(wrapper.style.pointerEvents).toBe('none');
  });

  it('shows status label in rows', async () => {
    const user = userEvent.setup();
    vi.mocked(api.quests.active).mockResolvedValue([
      makeQuest({ status: 'paused_input' }),
    ]);
    renderPartyMap();
    const banner = screen.getByRole('button', { name: /party map/i });
    await user.click(banner);
    await waitFor(() => {
      expect(screen.getByText('Awaiting Input')).toBeDefined();
    });
  });

  it('shows "⚔ Offline" in banner when the query errors', async () => {
    vi.mocked(api.quests.active).mockRejectedValue(new Error('Network error'));
    renderPartyMap();
    await waitFor(() => {
      expect(screen.getByText(/⚔ Offline/)).toBeDefined();
    });
  });

  it('empty state shows navigate button when no active quests', async () => {
    const user = userEvent.setup();
    vi.mocked(api.quests.active).mockResolvedValue([]);
    renderPartyMap();
    await waitFor(() => expect(screen.getByText(/⚔ No quests/)).toBeDefined());
    const banner = screen.getByRole('button', { name: /party map/i });
    await user.click(banner);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /go to town square/i })).toBeDefined();
    });
    await user.click(screen.getByRole('button', { name: /go to town square/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/town/town-square');
  });
});
