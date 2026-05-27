import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SceneKeyboardNav } from '../scene-keyboard-nav';
import type { SceneNavItem } from '../scene-keyboard-nav';

function makeItems(count: number): SceneNavItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    label: `Action ${i}`,
    onActivate: vi.fn(),
  }));
}

describe('SceneKeyboardNav', () => {
  it('renders nothing when items list is empty', () => {
    const { container } = render(<SceneKeyboardNav items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a nav landmark with correct aria-label', () => {
    const items = makeItems(2);
    render(<SceneKeyboardNav items={items} />);
    const nav = screen.getByRole('navigation', { name: 'Scene interactions' });
    expect(nav).toBeDefined();
  });

  it('renders a button for each item with correct label', () => {
    const items = makeItems(3);
    render(<SceneKeyboardNav items={items} />);
    for (const item of items) {
      expect(screen.getByRole('button', { name: item.label })).toBeDefined();
    }
  });

  it('calls onActivate when a button is clicked', async () => {
    const user = userEvent.setup();
    const items = makeItems(2);
    render(<SceneKeyboardNav items={items} />);

    await user.click(screen.getByRole('button', { name: items[0].label }));
    expect(items[0].onActivate).toHaveBeenCalledTimes(1);
    expect(items[1].onActivate).not.toHaveBeenCalled();
  });

  it('calls onActivate when Enter is pressed on a focused button', async () => {
    const user = userEvent.setup();
    const items = makeItems(2);
    render(<SceneKeyboardNav items={items} />);

    const button = screen.getByRole('button', { name: items[1].label });
    button.focus();
    await user.keyboard('{Enter}');

    expect(items[1].onActivate).toHaveBeenCalledTimes(1);
  });

  it('Tab cycles through all item buttons', async () => {
    const user = userEvent.setup();
    const items = makeItems(3);
    render(<SceneKeyboardNav items={items} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);

    buttons[0].focus();
    expect(buttons[0]).toHaveFocus();

    await user.tab();
    expect(buttons[1]).toHaveFocus();

    await user.tab();
    expect(buttons[2]).toHaveFocus();
  });

  it('nav region is visually hidden (has clip/overflow style)', () => {
    const items = makeItems(1);
    render(<SceneKeyboardNav items={items} />);
    const nav = screen.getByRole('navigation');
    const style = nav.style;
    expect(style.overflow).toBe('hidden');
    // jsdom normalizes rect(0, 0, 0, 0) → rect(0px, 0px, 0px, 0px)
    expect(style.clip).toMatch(/rect\(0/);
  });
});
