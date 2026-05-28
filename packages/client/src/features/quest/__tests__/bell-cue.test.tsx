import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { BellCue } from '../bell-cue';
import { useQuestStore } from '../../../stores/quest-store';

beforeEach(() => {
  useQuestStore.getState().reset('q-1');
});

describe('BellCue', () => {
  it('renders nothing when status is active', () => {
    act(() => { useQuestStore.getState().setStatus('q-1', 'active'); });
    const { container } = render(<BellCue questId="q-1" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders bell when status is paused_input', () => {
    act(() => { useQuestStore.getState().setStatus('q-1', 'paused_input'); });
    render(<BellCue questId="q-1" />);
    expect(screen.getByTestId('bell-cue')).toBeDefined();
  });

  it('renders bell when status is user_blocked', () => {
    act(() => { useQuestStore.getState().setStatus('q-1', 'user_blocked'); });
    render(<BellCue questId="q-1" />);
    expect(screen.getByTestId('bell-cue')).toBeDefined();
  });

  it('renders nothing when status is complete', () => {
    act(() => { useQuestStore.getState().setStatus('q-1', 'complete'); });
    const { container } = render(<BellCue questId="q-1" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders sr-only announcement when status transitions to paused_input', () => {
    const { rerender } = render(<BellCue questId="q-1" />);
    act(() => { useQuestStore.getState().setStatus('q-1', 'active'); });
    rerender(<BellCue questId="q-1" />);
    act(() => { useQuestStore.getState().setStatus('q-1', 'paused_input'); });
    rerender(<BellCue questId="q-1" />);
    expect(screen.getByText(/bell rings.*attention needed/i)).toBeDefined();
  });

  it('remounts announcement span on second bell event while component stays visible', () => {
    const { rerender } = render(<BellCue questId="q-1" />);
    act(() => { useQuestStore.getState().setStatus('q-1', 'paused_input'); });
    rerender(<BellCue questId="q-1" />);
    const first = screen.getByText(/bell rings.*attention needed/i);

    act(() => { useQuestStore.getState().setStatus('q-1', 'user_blocked'); });
    rerender(<BellCue questId="q-1" />);
    act(() => { useQuestStore.getState().setStatus('q-1', 'paused_input'); });
    rerender(<BellCue questId="q-1" />);
    const second = screen.getByText(/bell rings.*attention needed/i);

    expect(first).not.toBe(second);
  });
});
