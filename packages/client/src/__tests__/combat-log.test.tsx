import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CombatLog from '../features/quest/combat-log';
import { useQuestStore } from '../stores/quest-store';
import type { AgentEvent } from '@code-quests/shared';

function appendEvent(questId: string, event: AgentEvent) {
  useQuestStore.getState().appendEvent(questId, event);
}

function makeProgressEvent(message = 'Quest is underway'): AgentEvent {
  return { type: 'progress', timestamp: new Date().toISOString(), message };
}

function makeCombatEvent(message = 'The goblin strikes!'): AgentEvent {
  return { type: 'combat', timestamp: new Date().toISOString(), message };
}

function makeLogEvent(message = 'Agent log line'): AgentEvent {
  return { type: 'log', timestamp: new Date().toISOString(), message };
}

function makeCompletedEvent(): AgentEvent {
  return { type: 'completed', timestamp: new Date().toISOString(), summary: 'Quest completed' };
}

function makeFailedEvent(): AgentEvent {
  return { type: 'failed', timestamp: new Date().toISOString(), reason: 'Quest failed' };
}

function makeSceneChangeEvent(): AgentEvent {
  return {
    type: 'scene_change',
    timestamp: new Date().toISOString(),
    from: 'quest-forest',
    to: 'quest-cave',
  };
}

beforeEach(() => {
  useQuestStore.setState({ _nextId: 0, entriesByQuest: {}, currentSceneByQuest: {}, statusByQuest: {} });
});

afterEach(() => {
  useQuestStore.setState({ _nextId: 0, entriesByQuest: {}, currentSceneByQuest: {}, statusByQuest: {} });
  vi.clearAllMocks();
});

describe('CombatLog', () => {
  describe('empty state', () => {
    it('shows placeholder text when there are no log entries', () => {
      render(<CombatLog questId="q1" />);
      expect(screen.getByText(/combat log will appear here/i)).toBeDefined();
    });
  });

  describe('accessibility', () => {
    it('has role="log" on the container', () => {
      render(<CombatLog questId="q1" />);
      expect(screen.getByRole('log')).toBeDefined();
    });

    it('has aria-live="polite" on the container', () => {
      render(<CombatLog questId="q1" />);
      const el = screen.getByRole('log');
      expect(el.getAttribute('aria-live')).toBe('polite');
    });

    it('has aria-label="Combat log" on the container', () => {
      render(<CombatLog questId="q1" />);
      const el = screen.getByRole('log');
      expect(el.getAttribute('aria-label')).toBe('Combat log');
    });

    it('has aria-atomic="false" (announces only new additions)', () => {
      render(<CombatLog questId="q1" />);
      const el = screen.getByRole('log');
      expect(el.getAttribute('aria-atomic')).toBe('false');
    });
  });

  describe('event rendering', () => {
    it('renders progress events', () => {
      render(<CombatLog questId="q1" />);
      act(() => { appendEvent('q1', makeProgressEvent('Slaying goblins')); });
      expect(screen.getByText('Slaying goblins')).toBeDefined();
    });

    it('renders combat events', () => {
      render(<CombatLog questId="q1" />);
      act(() => { appendEvent('q1', makeCombatEvent('The troll attacks!')); });
      expect(screen.getByText('The troll attacks!')).toBeDefined();
    });

    it('renders log events', () => {
      render(<CombatLog questId="q1" />);
      act(() => { appendEvent('q1', makeLogEvent('Debug message')); });
      expect(screen.getByText('Debug message')).toBeDefined();
    });

    it('renders completed events with summary', () => {
      render(<CombatLog questId="q1" />);
      act(() => { appendEvent('q1', makeCompletedEvent()); });
      expect(screen.getByText('Quest completed')).toBeDefined();
    });

    it('renders failed events with reason', () => {
      render(<CombatLog questId="q1" />);
      act(() => { appendEvent('q1', makeFailedEvent()); });
      expect(screen.getByText('Quest failed')).toBeDefined();
    });

    it('shows type badge labels for log event types', () => {
      render(<CombatLog questId="q1" />);
      act(() => { appendEvent('q1', makeCombatEvent()); });
      expect(screen.getByText('Combat')).toBeDefined();
    });

    it('shows multiple entries in order', () => {
      render(<CombatLog questId="q1" />);
      act(() => {
        appendEvent('q1', makeProgressEvent('First'));
        appendEvent('q1', makeProgressEvent('Second'));
        appendEvent('q1', makeProgressEvent('Third'));
      });
      const entries = screen.getAllByText(/First|Second|Third/);
      expect(entries).toHaveLength(3);
    });
  });

  describe('event filtering', () => {
    it('filters out scene_change events (not in log)', () => {
      render(<CombatLog questId="q1" />);
      act(() => { appendEvent('q1', makeSceneChangeEvent()); });
      // scene_change has no text to show, and the empty state text should still be present
      expect(screen.getByText(/combat log will appear here/i)).toBeDefined();
    });

    it('does not show entries for a different questId', () => {
      render(<CombatLog questId="q1" />);
      act(() => { appendEvent('q2', makeProgressEvent('Other quest entry')); });
      expect(screen.queryByText('Other quest entry')).toBeNull();
      expect(screen.getByText(/combat log will appear here/i)).toBeDefined();
    });
  });

  describe('auto-scroll behavior', () => {
    it('sets scrollTop to scrollHeight when new entries arrive (auto-scroll)', () => {
      const { container } = render(<CombatLog questId="q1" />);
      const el = container.querySelector('[role="log"]') as HTMLDivElement;

      let scrollTopValue = 0;
      Object.defineProperty(el, 'scrollHeight', { value: 500, writable: true });
      Object.defineProperty(el, 'clientHeight', { value: 200, writable: true });
      Object.defineProperty(el, 'scrollTop', {
        get: () => scrollTopValue,
        set: (v: number) => { scrollTopValue = v; },
        configurable: true,
      });

      act(() => { appendEvent('q1', makeProgressEvent('Scroll test')); });

      expect(scrollTopValue).toBe(500);
    });

    it('does not auto-scroll when user has scrolled up', () => {
      const { container } = render(<CombatLog questId="q1" />);
      const el = container.querySelector('[role="log"]') as HTMLDivElement;

      let scrollTopValue = 50;
      Object.defineProperty(el, 'scrollHeight', { value: 500, writable: true });
      Object.defineProperty(el, 'clientHeight', { value: 200, writable: true });
      Object.defineProperty(el, 'scrollTop', {
        get: () => scrollTopValue,
        set: (v: number) => { scrollTopValue = v; },
        configurable: true,
      });

      // First add an entry to have content
      act(() => { appendEvent('q1', makeProgressEvent('First entry')); });
      // scrollTop was set to scrollHeight (500) by auto-scroll after first entry

      // Now simulate user scrolling up (scrollTop = 50, far from bottom)
      act(() => {
        scrollTopValue = 50;
        fireEvent.scroll(el);
      });

      // Clear the scroll counter to detect if auto-scroll fires again
      const scrollTopBefore = scrollTopValue;
      act(() => { appendEvent('q1', makeProgressEvent('Second entry')); });

      expect(scrollTopValue).toBe(scrollTopBefore);
    });

    it('auto-scroll resumes when user scrolls back to bottom', () => {
      const { container } = render(<CombatLog questId="q1" />);
      const el = container.querySelector('[role="log"]') as HTMLDivElement;

      let scrollTopValue = 0;
      const scrollHeight = 500;
      const clientHeight = 200;
      Object.defineProperty(el, 'scrollHeight', { value: scrollHeight, writable: true });
      Object.defineProperty(el, 'clientHeight', { value: clientHeight, writable: true });
      Object.defineProperty(el, 'scrollTop', {
        get: () => scrollTopValue,
        set: (v: number) => { scrollTopValue = v; },
        configurable: true,
      });

      // User scrolls up — auto-scroll pauses
      act(() => {
        scrollTopValue = 50;
        fireEvent.scroll(el);
      });

      // Add entry while paused — scrollTop stays at 50
      act(() => { appendEvent('q1', makeProgressEvent('Paused entry')); });
      expect(scrollTopValue).toBe(50);

      // User scrolls back to bottom — auto-scroll resumes
      act(() => {
        scrollTopValue = scrollHeight - clientHeight; // exactly at bottom (within tolerance)
        fireEvent.scroll(el);
      });

      // The effect re-runs when userScrolled changes to false, setting scrollTop to scrollHeight
      expect(scrollTopValue).toBe(scrollHeight);
    });
  });

  describe('timestamp formatting', () => {
    it('renders a timestamp with each entry', () => {
      render(<CombatLog questId="q1" />);
      act(() => { appendEvent('q1', makeProgressEvent('Test entry')); });
      // The timestamp should be visible — look for time format pattern HH:MM:SS
      const logEl = screen.getByRole('log');
      const text = logEl.textContent ?? '';
      expect(text).toMatch(/\d{2}:\d{2}:\d{2}/);
    });
  });
});
