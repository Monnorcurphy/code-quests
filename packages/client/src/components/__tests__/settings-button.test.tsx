import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsButton, applyReducedMotionPreference } from '../settings-button';

const STORAGE_KEY = 'code-quests:reduced-motion';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-reduced-motion');
});

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-reduced-motion');
});

describe('SettingsButton', () => {
  it('renders the settings gear button', () => {
    render(<SettingsButton />);
    expect(screen.getByRole('button', { name: 'Open settings' })).toBeDefined();
  });

  it('opens the settings panel when clicked', async () => {
    const user = userEvent.setup();
    render(<SettingsButton />);

    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeDefined();
  });

  it('closes the settings panel when Close is clicked', async () => {
    const user = userEvent.setup();
    render(<SettingsButton />);

    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull();
  });

  it('closes the settings panel on Escape', async () => {
    const user = userEvent.setup();
    render(<SettingsButton />);

    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeDefined();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull();
  });

  it('reduce motion checkbox starts unchecked when localStorage has no value', async () => {
    const user = userEvent.setup();
    render(<SettingsButton />);

    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    const checkbox = screen.getByLabelText('Reduce motion') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('toggling reduce motion writes to localStorage', async () => {
    const user = userEvent.setup();
    render(<SettingsButton />);

    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    await user.click(screen.getByLabelText('Reduce motion'));

    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('toggling reduce motion sets data-reduced-motion attribute on documentElement', async () => {
    const user = userEvent.setup();
    render(<SettingsButton />);

    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    await user.click(screen.getByLabelText('Reduce motion'));

    expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('true');
  });

  it('toggling off removes the data-reduced-motion attribute', async () => {
    const user = userEvent.setup();
    render(<SettingsButton />);

    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    const checkbox = screen.getByLabelText('Reduce motion');
    await user.click(checkbox); // on
    await user.click(checkbox); // off

    expect(document.documentElement.getAttribute('data-reduced-motion')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
  });

  it('shows checkbox as checked when localStorage has true on open', async () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    const user = userEvent.setup();
    render(<SettingsButton />);

    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    const checkbox = screen.getByLabelText('Reduce motion') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });
});

describe('applyReducedMotionPreference', () => {
  it('sets data-reduced-motion when localStorage has true', () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    applyReducedMotionPreference();
    expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('true');
  });

  it('does nothing when localStorage has no value', () => {
    applyReducedMotionPreference();
    expect(document.documentElement.getAttribute('data-reduced-motion')).toBeNull();
  });

  it('does nothing when localStorage has false', () => {
    localStorage.setItem(STORAGE_KEY, 'false');
    applyReducedMotionPreference();
    expect(document.documentElement.getAttribute('data-reduced-motion')).toBeNull();
  });
});
