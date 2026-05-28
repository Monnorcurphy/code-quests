import { useEffect, useRef, useState } from 'react';
import { useQuestStore } from '../../stores/quest-store';
import type { StoredEvent } from '../../stores/quest-store';
import type { AgentEvent } from '@code-quests/shared';

const LOG_EVENT_TYPES = new Set<AgentEvent['type']>(['progress', 'log', 'combat', 'completed', 'failed']);
const EMPTY_ENTRIES: StoredEvent[] = [];

const TYPE_LABELS: Partial<Record<AgentEvent['type'], string>> = {
  progress: 'Progress',
  log: 'Log',
  combat: 'Combat',
  completed: 'Complete',
  failed: 'Failed',
};

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return ts;
  }
}

function getMessage(event: StoredEvent): string {
  if (event.type === 'progress' || event.type === 'log') return event.message;
  if (event.type === 'combat') return event.message;
  if (event.type === 'completed') return event.summary ?? 'Quest completed';
  if (event.type === 'failed') return event.reason ?? 'Quest failed';
  return '';
}

interface CombatLogProps {
  questId: string;
}

export default function CombatLog({ questId }: CombatLogProps) {
  const entries = useQuestStore((s) => s.entriesByQuest[questId] ?? EMPTY_ENTRIES);
  const logEntries = entries.filter((e) => LOG_EVENT_TYPES.has(e.type));

  const containerRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || userScrolled) return;
    el.scrollTop = el.scrollHeight;
  }, [logEntries.length, userScrolled]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 8;
    setUserScrolled(!atBottom);
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      role="log"
      aria-label="Combat log"
      aria-live="polite"
      aria-atomic="false"
      style={{
        overflowY: 'auto',
        maxHeight: '100%',
        padding: '6px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}
    >
      {logEntries.length === 0 ? (
        <p
          className="text-gray-200"
          style={{ margin: 0, fontSize: '0.8rem', fontStyle: 'italic' }}
        >
          Combat log will appear here
        </p>
      ) : (
        logEntries.map((event) => (
          <div
            key={event._id}
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'baseline',
              fontSize: '0.78rem',
            }}
          >
            <span className="text-gray-300" style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
              {formatTimestamp(event.timestamp)}
            </span>
            <span
              className="text-gray-100"
              style={{
                padding: '1px 5px',
                borderRadius: '3px',
                background: 'rgba(255,255,255,0.12)',
                flexShrink: 0,
                fontSize: '0.7rem',
                fontWeight: 600,
              }}
            >
              {TYPE_LABELS[event.type] ?? event.type}
            </span>
            <span className="text-gray-100">{getMessage(event)}</span>
          </div>
        ))
      )}
    </div>
  );
}
