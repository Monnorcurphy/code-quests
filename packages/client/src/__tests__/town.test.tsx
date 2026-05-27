import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Town from '../routes/town';

function renderTown() {
  return render(
    <MemoryRouter>
      <Town />
    </MemoryRouter>,
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

  it('opens a placeholder modal when a building is clicked', async () => {
    const user = userEvent.setup();
    renderTown();

    const warRoomBtn = screen.getByRole('button', { name: /War Room/i });
    await user.click(warRoomBtn);

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Coming in Phase 2 — Phaser scene')).toBeDefined();
  });

  it('shows the building name in the modal title', async () => {
    const user = userEvent.setup();
    renderTown();

    await user.click(screen.getByRole('button', { name: /Oracle/i }));

    expect(screen.getByRole('heading', { name: 'Oracle', level: 2 })).toBeDefined();
  });

  it('closes the modal when the Close button is clicked', async () => {
    const user = userEvent.setup();
    renderTown();

    await user.click(screen.getByRole('button', { name: /Town Square/i }));
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

  it('modal has aria-modal and aria-labelledby', async () => {
    const user = userEvent.setup();
    renderTown();

    await user.click(screen.getByRole('button', { name: /Guild Hall/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('modal-title');
  });
});
