import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Library from '../features/library';
import { useTownStore } from '../stores/town-store';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      monsters: {
        list: vi.fn().mockResolvedValue([]),
        listTypes: vi.fn().mockResolvedValue([]),
        get: vi.fn(),
        listEncounters: vi.fn(),
        listQuestEncounters: vi.fn(),
        promoteNemesis: vi.fn(),
        createType: vi.fn(),
      },
      skills: {
        list: vi.fn().mockResolvedValue([]),
        get: vi.fn(),
        forge: vi.fn(),
        confirmCandidate: vi.fn(),
        dismissCandidate: vi.fn(),
        retire: vi.fn(),
      },
    },
  };
});

function renderLibrary(initialEntries = ['/town/library']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <Library />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('Library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    useTownStore.setState({ selectedQuestId: null });
  });

  it('renders the Library title', () => {
    renderLibrary();
    expect(screen.getByText('Library')).toBeDefined();
  });

  it('shows Bestiary and Skills tabs', () => {
    renderLibrary();
    expect(screen.getByRole('tab', { name: 'Bestiary' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Skills' })).toBeDefined();
  });

  it('Bestiary tab is active by default', () => {
    renderLibrary();
    const bestiaryTab = screen.getByRole('tab', { name: 'Bestiary' });
    expect(bestiaryTab.getAttribute('aria-selected')).toBe('true');
  });

  it('Skills tab shows the skills section headings when clicked', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await user.click(screen.getByRole('tab', { name: 'Skills' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /skill candidates/i })).toBeDefined();
      expect(screen.getByRole('heading', { name: /unlocked skills/i })).toBeDefined();
    });
  });

  it('switches active tab on click', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await user.click(screen.getByRole('tab', { name: 'Skills' }));
    expect(screen.getByRole('tab', { name: 'Skills' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Bestiary' }).getAttribute('aria-selected')).toBe('false');
  });

  it('Close button calls setActiveModal(null)', async () => {
    const mockSetActiveModal = vi.fn();
    useTownStore.setState({ setActiveModal: mockSetActiveModal });
    const user = userEvent.setup();
    renderLibrary();
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(mockSetActiveModal).toHaveBeenCalledWith(null);
  });

  it('shows the bestiary empty state when no monsters', async () => {
    renderLibrary();
    await waitFor(() => {
      expect(screen.getByText(/no monsters encountered yet/i)).toBeDefined();
    });
  });
});
