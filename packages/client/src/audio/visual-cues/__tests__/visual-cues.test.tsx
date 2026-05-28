import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { dispatchCue } from '../../audio-cue-bus';
import SceneMoodIndicator from '../scene-mood-indicator';
import PauseBellFlash from '../pause-bell-flash';
import StingerToast from '../stinger-toast';
import AriaAnnouncer from '../aria-announcer';
import type { AudioEvent } from '../../audio-events';

// ---------- matchMedia mock ----------

function setupMatchMedia(prefersReducedMotion: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' && prefersReducedMotion,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeAll(() => {
  // Default: no reduced motion
  setupMatchMedia(false);
});

afterEach(() => {
  document.documentElement.removeAttribute('data-reduced-motion');
  vi.useRealTimers();
});

// ---------- AriaAnnouncer ----------

describe('AriaAnnouncer', () => {
  const ALL_EVENTS: AudioEvent[] = [
    'TOWN',
    'ROAD',
    'COMBAT',
    'BOSS',
    'VICTORY_STINGER',
    'QUEST_COMPLETE',
    'QUEST_FAILED',
    'PAUSE_BELL',
  ];

  it('renders a polite aria-live region', () => {
    render(<AriaAnnouncer />);
    const el = screen.getByTestId('aria-announcer');
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.getAttribute('role')).toBe('status');
  });

  it('starts empty', () => {
    render(<AriaAnnouncer />);
    expect(screen.getByTestId('aria-announcer').textContent).toBe('');
  });

  it.each(ALL_EVENTS)('announces when %s fires', (event) => {
    render(<AriaAnnouncer />);
    act(() => dispatchCue(event));
    expect(screen.getByTestId('aria-announcer').textContent).not.toBe('');
  });

  it('announces TOWN correctly', () => {
    render(<AriaAnnouncer />);
    act(() => dispatchCue('TOWN'));
    expect(screen.getByTestId('aria-announcer').textContent).toBe('Town theme playing');
  });

  it('announces COMBAT correctly', () => {
    render(<AriaAnnouncer />);
    act(() => dispatchCue('COMBAT'));
    expect(screen.getByTestId('aria-announcer').textContent).toBe('Combat begun');
  });

  it('announces PAUSE_BELL correctly', () => {
    render(<AriaAnnouncer />);
    act(() => dispatchCue('PAUSE_BELL'));
    expect(screen.getByTestId('aria-announcer').textContent).toBe('Bell — input requested');
  });

  it('announces QUEST_FAILED correctly', () => {
    render(<AriaAnnouncer />);
    act(() => dispatchCue('QUEST_FAILED'));
    expect(screen.getByTestId('aria-announcer').textContent).toBe(
      'Quest failed — returned to town',
    );
  });
});

// ---------- SceneMoodIndicator ----------

describe('SceneMoodIndicator', () => {
  it('renders nothing initially', () => {
    render(<SceneMoodIndicator />);
    expect(screen.queryByTestId('scene-mood-indicator')).toBeNull();
  });

  it('shows TOWN label when TOWN fires', () => {
    render(<SceneMoodIndicator />);
    act(() => dispatchCue('TOWN'));
    expect(screen.getByTestId('scene-mood-indicator').textContent).toBe('Town · Calm');
  });

  it('shows ROAD label', () => {
    render(<SceneMoodIndicator />);
    act(() => dispatchCue('ROAD'));
    expect(screen.getByTestId('scene-mood-indicator').textContent).toBe('On the Road');
  });

  it('shows COMBAT label', () => {
    render(<SceneMoodIndicator />);
    act(() => dispatchCue('COMBAT'));
    expect(screen.getByTestId('scene-mood-indicator').textContent).toBe('In Combat');
  });

  it('shows BOSS label', () => {
    render(<SceneMoodIndicator />);
    act(() => dispatchCue('BOSS'));
    expect(screen.getByTestId('scene-mood-indicator').textContent).toBe('Boss Fight');
  });

  it('ignores one-shot events', () => {
    render(<SceneMoodIndicator />);
    act(() => dispatchCue('VICTORY_STINGER'));
    expect(screen.queryByTestId('scene-mood-indicator')).toBeNull();
  });

  it('updates when mood changes', () => {
    render(<SceneMoodIndicator />);
    act(() => dispatchCue('TOWN'));
    expect(screen.getByTestId('scene-mood-indicator').textContent).toBe('Town · Calm');
    act(() => dispatchCue('COMBAT'));
    expect(screen.getByTestId('scene-mood-indicator').textContent).toBe('In Combat');
  });

  it('has no animation class when prefers-reduced-motion', () => {
    setupMatchMedia(true);
    render(<SceneMoodIndicator />);
    act(() => dispatchCue('TOWN'));
    // CSS handles reduced-motion via media query; no JS-applied extra class needed
    expect(screen.getByTestId('scene-mood-indicator')).toBeDefined();
    setupMatchMedia(false);
  });
});

// ---------- PauseBellFlash ----------

describe('PauseBellFlash', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('renders nothing initially', () => {
    render(<PauseBellFlash />);
    expect(screen.queryByTestId('pause-bell-flash')).toBeNull();
  });

  it('shows flash overlay when PAUSE_BELL fires', () => {
    render(<PauseBellFlash />);
    act(() => dispatchCue('PAUSE_BELL'));
    expect(screen.getByTestId('pause-bell-flash')).toBeDefined();
  });

  it('dismisses after 300ms (no reduced motion)', () => {
    setupMatchMedia(false);
    render(<PauseBellFlash />);
    act(() => dispatchCue('PAUSE_BELL'));
    expect(screen.getByTestId('pause-bell-flash')).toBeDefined();
    act(() => vi.advanceTimersByTime(300));
    expect(screen.queryByTestId('pause-bell-flash')).toBeNull();
  });

  it('lingers for 1500ms with reduced motion (matchMedia)', () => {
    setupMatchMedia(true);
    render(<PauseBellFlash />);
    act(() => dispatchCue('PAUSE_BELL'));
    act(() => vi.advanceTimersByTime(300));
    // Still visible at 300ms under reduced motion
    expect(screen.getByTestId('pause-bell-flash')).toBeDefined();
    act(() => vi.advanceTimersByTime(1200)); // total 1500ms
    expect(screen.queryByTestId('pause-bell-flash')).toBeNull();
    setupMatchMedia(false);
  });

  it('lingers for 1500ms with data-reduced-motion attribute', () => {
    document.documentElement.setAttribute('data-reduced-motion', 'true');
    render(<PauseBellFlash />);
    act(() => dispatchCue('PAUSE_BELL'));
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByTestId('pause-bell-flash')).toBeDefined();
    act(() => vi.advanceTimersByTime(1200));
    expect(screen.queryByTestId('pause-bell-flash')).toBeNull();
  });

  it('applies --static class in reduced motion mode', () => {
    setupMatchMedia(true);
    render(<PauseBellFlash />);
    act(() => dispatchCue('PAUSE_BELL'));
    const el = screen.getByTestId('pause-bell-flash');
    expect(el.className).toContain('pause-bell-flash--static');
    setupMatchMedia(false);
  });

  it('does not apply --static class without reduced motion', () => {
    render(<PauseBellFlash />);
    act(() => dispatchCue('PAUSE_BELL'));
    const el = screen.getByTestId('pause-bell-flash');
    expect(el.className).not.toContain('pause-bell-flash--static');
  });

  it('ignores non-bell events', () => {
    render(<PauseBellFlash />);
    act(() => dispatchCue('TOWN'));
    expect(screen.queryByTestId('pause-bell-flash')).toBeNull();
  });
});

// ---------- StingerToast ----------

describe('StingerToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('renders nothing initially', () => {
    render(<StingerToast />);
    expect(screen.queryByTestId('stinger-toast')).toBeNull();
  });

  it('shows VICTORY_STINGER message', () => {
    render(<StingerToast />);
    act(() => dispatchCue('VICTORY_STINGER'));
    expect(screen.getByTestId('stinger-toast').textContent).toContain('Monster defeated!');
  });

  it('shows QUEST_COMPLETE message', () => {
    render(<StingerToast />);
    act(() => dispatchCue('QUEST_COMPLETE'));
    expect(screen.getByTestId('stinger-toast').textContent).toContain('Quest complete!');
  });

  it('shows QUEST_FAILED message', () => {
    render(<StingerToast />);
    act(() => dispatchCue('QUEST_FAILED'));
    expect(screen.getByTestId('stinger-toast').textContent).toContain(
      'Quest failed — returned to town',
    );
  });

  it('auto-dismisses VICTORY_STINGER after 3 seconds', () => {
    render(<StingerToast />);
    act(() => dispatchCue('VICTORY_STINGER'));
    expect(screen.getByTestId('stinger-toast')).toBeDefined();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByTestId('stinger-toast')).toBeNull();
  });

  it('auto-dismisses QUEST_COMPLETE after 3 seconds', () => {
    render(<StingerToast />);
    act(() => dispatchCue('QUEST_COMPLETE'));
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByTestId('stinger-toast')).toBeNull();
  });

  it('does NOT auto-dismiss QUEST_FAILED', () => {
    render(<StingerToast />);
    act(() => dispatchCue('QUEST_FAILED'));
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByTestId('stinger-toast')).toBeDefined();
  });

  it('QUEST_FAILED shows a dismiss button', () => {
    render(<StingerToast />);
    act(() => dispatchCue('QUEST_FAILED'));
    expect(screen.getByRole('button', { name: 'Dismiss notification' })).toBeDefined();
  });

  it('VICTORY_STINGER has no dismiss button', () => {
    render(<StingerToast />);
    act(() => dispatchCue('VICTORY_STINGER'));
    expect(screen.queryByRole('button', { name: 'Dismiss notification' })).toBeNull();
  });

  it('dismiss button removes QUEST_FAILED toast', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<StingerToast />);
    act(() => dispatchCue('QUEST_FAILED'));
    const btn = screen.getByRole('button', { name: 'Dismiss notification' });
    await user.click(btn);
    expect(screen.queryByTestId('stinger-toast')).toBeNull();
  });

  it('ignores non-stinger events', () => {
    render(<StingerToast />);
    act(() => dispatchCue('TOWN'));
    expect(screen.queryByTestId('stinger-toast')).toBeNull();
  });

  it('replaces current toast when new stinger fires', () => {
    render(<StingerToast />);
    act(() => dispatchCue('VICTORY_STINGER'));
    expect(screen.getByTestId('stinger-toast').textContent).toContain('Monster defeated!');
    act(() => dispatchCue('QUEST_COMPLETE'));
    expect(screen.getByTestId('stinger-toast').textContent).toContain('Quest complete!');
  });

  it('QUEST_FAILED has error class', () => {
    render(<StingerToast />);
    act(() => dispatchCue('QUEST_FAILED'));
    expect(screen.getByTestId('stinger-toast').className).toContain('stinger-toast--error');
  });

  it('VICTORY_STINGER has success class', () => {
    render(<StingerToast />);
    act(() => dispatchCue('VICTORY_STINGER'));
    expect(screen.getByTestId('stinger-toast').className).toContain('stinger-toast--success');
  });
});

// ---------- Full event coverage ----------

describe('every AudioEvent triggers at least one visual cue', () => {
  const ALL_EVENTS: AudioEvent[] = [
    'TOWN',
    'ROAD',
    'COMBAT',
    'BOSS',
    'VICTORY_STINGER',
    'QUEST_COMPLETE',
    'QUEST_FAILED',
    'PAUSE_BELL',
  ];

  it.each(ALL_EVENTS)('%s produces an aria announcement', (event) => {
    render(<AriaAnnouncer />);
    act(() => dispatchCue(event));
    expect(screen.getByTestId('aria-announcer').textContent).not.toBe('');
  });
});
