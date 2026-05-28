import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AudioSettings } from '../audio-settings';
import { AudioProvider } from '../../audio/audio-provider';
import { useAudioStore } from '../../stores/audio-store';

// Mock WebAudioBackend and SilentBackend so tests don't need a real AudioContext
vi.mock('../../audio/web-audio-backend', () => ({
  WebAudioBackend: vi.fn().mockImplementation(() => ({
    setMasterVolume: vi.fn(),
    setMuted: vi.fn(),
    dispose: vi.fn(),
    resume: vi.fn(),
    preload: vi.fn().mockResolvedValue(undefined),
    play: vi.fn(),
    stop: vi.fn(),
    stopAll: vi.fn(),
  })),
}));

vi.mock('../../audio/silent-backend', () => ({
  SilentBackend: vi.fn().mockImplementation(() => ({
    setMasterVolume: vi.fn(),
    setMuted: vi.fn(),
    dispose: vi.fn(),
    preload: vi.fn().mockResolvedValue(undefined),
    play: vi.fn(),
    stop: vi.fn(),
    stopAll: vi.fn(),
    calls: [],
  })),
}));

function resetStore() {
  useAudioStore.setState({
    muted: false,
    silentMode: false,
    masterVolume: 0.7,
    currentEvent: null,
  });
}

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
});

describe('AudioSettings — mute toggle', () => {
  it('renders with aria-checked=false when not muted', () => {
    render(<AudioSettings />);
    const btn = screen.getByRole('switch', { name: 'Mute' });
    expect(btn).toBeDefined();
    expect(btn.getAttribute('aria-checked')).toBe('false');
  });

  it('clicking mute toggle updates the store', async () => {
    const user = userEvent.setup();
    render(<AudioSettings />);
    const btn = screen.getByRole('switch', { name: 'Mute' });
    await user.click(btn);
    expect(useAudioStore.getState().muted).toBe(true);
  });

  it('clicking again un-mutes', async () => {
    const user = userEvent.setup();
    render(<AudioSettings />);
    const btn = screen.getByRole('switch', { name: 'Mute' });
    await user.click(btn);
    await user.click(btn);
    expect(useAudioStore.getState().muted).toBe(false);
  });

  it('aria-checked reflects store state', async () => {
    const user = userEvent.setup();
    render(<AudioSettings />);
    const btn = screen.getByRole('switch', { name: 'Mute' });
    await user.click(btn);
    expect(btn.getAttribute('aria-checked')).toBe('true');
  });

  it('Space key toggles mute', async () => {
    const user = userEvent.setup();
    render(<AudioSettings />);
    const btn = screen.getByRole('switch', { name: 'Mute' });
    btn.focus();
    await user.keyboard(' ');
    expect(useAudioStore.getState().muted).toBe(true);
  });
});

describe('AudioSettings — silent mode toggle', () => {
  it('renders with aria-checked=false when silent mode is off', () => {
    render(<AudioSettings />);
    const btn = screen.getByRole('switch', { name: 'Silent Mode' });
    expect(btn.getAttribute('aria-checked')).toBe('false');
  });

  it('shows helper text', () => {
    render(<AudioSettings />);
    expect(
      screen.getByText('Disables all sound and replaces audio cues with visual indicators.'),
    ).toBeDefined();
  });

  it('clicking silent mode toggle updates the store', async () => {
    const user = userEvent.setup();
    render(<AudioSettings />);
    const btn = screen.getByRole('switch', { name: 'Silent Mode' });
    await user.click(btn);
    expect(useAudioStore.getState().silentMode).toBe(true);
  });

  it('Space key toggles silent mode', async () => {
    const user = userEvent.setup();
    render(<AudioSettings />);
    const btn = screen.getByRole('switch', { name: 'Silent Mode' });
    btn.focus();
    await user.keyboard(' ');
    expect(useAudioStore.getState().silentMode).toBe(true);
  });
});

describe('AudioSettings — volume slider', () => {
  it('renders slider with min=0 max=100', () => {
    render(<AudioSettings />);
    const slider = screen.getByRole('slider', { name: 'Master Volume' });
    expect(slider.getAttribute('min')).toBe('0');
    expect(slider.getAttribute('max')).toBe('100');
    expect(slider.getAttribute('step')).toBe('1');
  });

  it('reflects initial store volume as display percentage', () => {
    render(<AudioSettings />);
    const slider = screen.getByRole('slider', { name: 'Master Volume' }) as HTMLInputElement;
    // Store starts at 0.7 → display 70
    expect(slider.value).toBe('70');
    expect(slider.getAttribute('aria-valuetext')).toBe('70 percent');
  });

  it('dragging to 50 updates the store to 0.5', () => {
    render(<AudioSettings />);
    const slider = screen.getByRole('slider', { name: 'Master Volume' });
    fireEvent.change(slider, { target: { valueAsNumber: 50 } });
    expect(useAudioStore.getState().masterVolume).toBeCloseTo(0.5);
  });

  it('aria-valuetext announces new value after change', () => {
    render(<AudioSettings />);
    const slider = screen.getByRole('slider', { name: 'Master Volume' });
    fireEvent.change(slider, { target: { valueAsNumber: 50 } });
    expect(slider.getAttribute('aria-valuetext')).toBe('50 percent');
  });

  it('volume label shows current percent', () => {
    render(<AudioSettings />);
    expect(screen.getByText('70%')).toBeDefined();
  });
});

describe('AudioSettings — keyboard navigation', () => {
  it('Tab moves focus from mute to silent mode to volume slider', async () => {
    const user = userEvent.setup();
    render(<AudioSettings />);

    const mute = screen.getByRole('switch', { name: 'Mute' });
    const silent = screen.getByRole('switch', { name: 'Silent Mode' });
    const slider = screen.getByRole('slider', { name: 'Master Volume' });

    mute.focus();
    expect(document.activeElement).toBe(mute);

    await user.tab();
    expect(document.activeElement).toBe(silent);

    await user.tab();
    expect(document.activeElement).toBe(slider);
  });
});

describe('AudioSettings — persistence round-trip', () => {
  it('reads persisted muted=true from store on mount', () => {
    useAudioStore.setState({ muted: true });
    render(<AudioSettings />);
    const btn = screen.getByRole('switch', { name: 'Mute' });
    expect(btn.getAttribute('aria-checked')).toBe('true');
    expect(btn.textContent).toBe('On');
  });

  it('reads persisted silentMode=true from store on mount', () => {
    useAudioStore.setState({ silentMode: true });
    render(<AudioSettings />);
    const btn = screen.getByRole('switch', { name: 'Silent Mode' });
    expect(btn.getAttribute('aria-checked')).toBe('true');
  });

  it('reads persisted masterVolume=0.3 from store on mount', () => {
    useAudioStore.setState({ masterVolume: 0.3 });
    render(<AudioSettings />);
    const slider = screen.getByRole('slider', { name: 'Master Volume' }) as HTMLInputElement;
    expect(slider.value).toBe('30');
    expect(slider.getAttribute('aria-valuetext')).toBe('30 percent');
  });
});

describe('AudioProvider — backend swap', () => {
  it('swaps backend when silentMode changes in the store', async () => {
    const { WebAudioBackend } = await import('../../audio/web-audio-backend');
    const { SilentBackend } = await import('../../audio/silent-backend');

    const user = userEvent.setup();
    render(
      <AudioProvider>
        <AudioSettings />
      </AudioProvider>,
    );

    // Initial backend is WebAudioBackend (silentMode=false)
    expect(WebAudioBackend).toHaveBeenCalledTimes(1);

    // Toggle silent mode on
    await user.click(screen.getByRole('switch', { name: 'Silent Mode' }));

    // Old WebAudioBackend disposed, new SilentBackend created
    const webMock = WebAudioBackend as unknown as Mock;
    const webInstance = webMock.mock.results[0].value as { dispose: Mock };
    expect(webInstance.dispose).toHaveBeenCalled();
    expect(SilentBackend).toHaveBeenCalledTimes(1);
  });
});
