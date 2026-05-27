import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Town from '../routes/town';

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
    },
  };
});

function renderTown() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Town />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Town', () => {
  it('renders all 8 buildings', () => {
    renderTown();
    const buildings = [
      'Town Square',
      'War Room',
      'Oracle',
      'Library',
      'Tavern',
      'Armory',
      'Guild Hall',
      'Hall of Returns',
    ];
    for (const name of buildings) {
      expect(screen.getByText(name)).toBeDefined();
    }
  });

  it('renders the town heading', () => {
    renderTown();
    expect(screen.getByRole('heading', { name: 'The Town', level: 1 })).toBeDefined();
  });

  it('renders buildings as buttons', () => {
    renderTown();
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(8);
  });

  it('opens a placeholder modal when a generic building is clicked', async () => {
    const user = userEvent.setup();
    renderTown();

    const oracleBtn = screen.getByRole('button', { name: /Oracle/i });
    await user.click(oracleBtn);

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Refine Acceptance Criteria — arriving in Phase 3.')).toBeDefined();
  });

  it('shows the building name in the modal title', async () => {
    const user = userEvent.setup();
    renderTown();

    await user.click(screen.getByRole('button', { name: /Oracle/i }));

    expect(screen.getByRole('heading', { name: 'Oracle', level: 2 })).toBeDefined();
  });

  it('closes the modal when the Close button is clicked (generic building)', async () => {
    const user = userEvent.setup();
    renderTown();

    await user.click(screen.getByRole('button', { name: /Oracle/i }));
    expect(screen.getByRole('dialog')).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the modal when Escape is pressed', async () => {
    const user = userEvent.setup();
    renderTown();

    await user.click(screen.getByRole('button', { name: /Armory/i }));
    expect(screen.getByRole('dialog')).toBeDefined();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('can open a building with Enter key', async () => {
    const user = userEvent.setup();
    renderTown();

    const libraryBtn = screen.getByRole('button', { name: /Library/i });
    libraryBtn.focus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Library', level: 2 })).toBeDefined();
  });

  it('generic modal has aria-modal and aria-labelledby', async () => {
    const user = userEvent.setup();
    renderTown();

    await user.click(screen.getByRole('button', { name: /Armory/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('modal-title');
  });

  it('Guild Hall opens a dialog with aria-modal', async () => {
    const user = userEvent.setup();
    renderTown();

    await user.click(screen.getByRole('button', { name: /Guild Hall/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('guild-hall-title');
  });

  it('Town Square opens a dialog with roster and recruit button', async () => {
    const user = userEvent.setup();
    renderTown();

    await user.click(screen.getByRole('button', { name: /Town Square/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByRole('button', { name: 'Recruit an Adventurer' })).toBeDefined();
  });

  it('War Room opens the draft form dialog', async () => {
    const user = userEvent.setup();
    renderTown();

    await user.click(screen.getByRole('button', { name: /War Room/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('war-room-title');
    expect(screen.getByRole('heading', { name: 'War Room', level: 2 })).toBeDefined();
    expect(screen.getByLabelText('Title')).toBeDefined();
  });

  it('traps focus inside the modal — Tab cycles to Close', async () => {
    const user = userEvent.setup();
    renderTown();
    await user.click(screen.getByRole('button', { name: /Oracle/i }));
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
  });
});
