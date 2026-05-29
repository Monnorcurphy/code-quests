import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AutoMatchPreview from '../features/quests/auto-match-preview';
import type { Adventurer } from '@code-quests/shared';

const { mockAutoMatch } = vi.hoisted(() => ({
  mockAutoMatch: vi.fn(),
}));

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      quests: {
        ...actual.api.quests,
        autoMatch: mockAutoMatch,
      },
    },
  };
});

const ADVENTURERS: Adventurer[] = [
  {
    id: 'adv-brielle',
    name: 'Brielle the Bold',
    class: 'champion',
    modelId: 'haiku',
    createdAt: '2024-01-01T00:00:00Z',
    stats: { questsWon: 8 },
    specializations: [],
    scars: [],
  },
  {
    id: 'adv-rook',
    name: 'Rook the Resolute',
    class: 'scout',
    modelId: 'haiku',
    createdAt: '2024-01-02T00:00:00Z',
    stats: {},
    specializations: [],
    scars: [],
  },
];

const MATCH_RESPONSE = {
  adventurerId: 'adv-brielle',
  adventurerName: 'Brielle the Bold',
  adventurerClass: 'champion' as const,
  reason: 'Champion class + 8 wins, no relevant scars',
};

function renderPreview(opts: {
  questId?: string;
  adventurers?: Adventurer[];
  selectedAdventurerId?: string | null;
  onSelectAdventurer?: (id: string | null) => void;
} = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const onSelectAdventurer = opts.onSelectAdventurer ?? vi.fn();

  render(
    <QueryClientProvider client={qc}>
      <AutoMatchPreview
        questId={opts.questId ?? 'q-1'}
        adventurers={opts.adventurers ?? ADVENTURERS}
        selectedAdventurerId={opts.selectedAdventurerId ?? null}
        onSelectAdventurer={onSelectAdventurer}
      />
    </QueryClientProvider>,
  );

  return { onSelectAdventurer };
}

describe('AutoMatchPreview', () => {
  beforeEach(() => {
    mockAutoMatch.mockReset();
  });

  it('shows loading state while fetching', () => {
    mockAutoMatch.mockReturnValue(new Promise(() => {})); // never resolves
    renderPreview();
    expect(screen.getByText(/finding best adventurer/i)).toBeDefined();
  });

  it('shows the suggested adventurer name and reason after load', async () => {
    mockAutoMatch.mockResolvedValue(MATCH_RESPONSE);
    renderPreview();

    await waitFor(() => {
      // The reason text is unique — only appears in the suggestion, not the dropdown
      expect(screen.getByText(/Champion class \+ 8 wins/)).toBeDefined();
    });
    // The suggestion label should be visible
    expect(screen.getByText('Suggested:')).toBeDefined();
  });

  it('shows an error message when the request fails', async () => {
    mockAutoMatch.mockRejectedValue(new Error('Network error'));
    renderPreview();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
    expect(screen.getByRole('alert').textContent).toMatch(/could not load suggestion/i);
  });

  it('shows empty state message when no adventurers exist in the guild', async () => {
    mockAutoMatch.mockResolvedValue({
      adventurerId: null,
      adventurerName: null,
      adventurerClass: null,
      reason: 'No available adventurer — recruit one in the Guild Hall',
    });
    renderPreview({ adventurers: [] });

    await waitFor(() => {
      expect(screen.getByText(/no adventurers in the guild/i)).toBeDefined();
    });
  });

  it('calls onSelectAdventurer with the auto-matched id after load', async () => {
    mockAutoMatch.mockResolvedValue(MATCH_RESPONSE);
    const { onSelectAdventurer } = renderPreview();

    await waitFor(() => {
      expect(onSelectAdventurer).toHaveBeenCalledWith('adv-brielle');
    });
  });

  it('override dropdown lists all adventurers', async () => {
    mockAutoMatch.mockResolvedValue(MATCH_RESPONSE);
    renderPreview();

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeDefined();
    });

    const select = screen.getByRole('combobox');
    expect(select.querySelectorAll('option').length).toBe(3); // auto-select + 2 adventurers
  });

  it('calls onSelectAdventurer with the chosen id when user picks from dropdown', async () => {
    mockAutoMatch.mockResolvedValue(MATCH_RESPONSE);
    const onSelect = vi.fn();
    renderPreview({ onSelectAdventurer: onSelect });

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeDefined();
    });

    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole('combobox'), 'adv-rook');
    expect(onSelect).toHaveBeenCalledWith('adv-rook');
  });

  it('does not re-select when selectedAdventurerId is already set', async () => {
    mockAutoMatch.mockResolvedValue(MATCH_RESPONSE);
    const onSelect = vi.fn();
    renderPreview({ selectedAdventurerId: 'adv-rook', onSelectAdventurer: onSelect });

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeDefined();
    });

    // onSelect should NOT have been called because selectedAdventurerId was already non-null
    expect(onSelect).not.toHaveBeenCalled();
  });
});
