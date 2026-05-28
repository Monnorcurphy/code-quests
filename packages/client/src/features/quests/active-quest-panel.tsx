import { useEffect, useRef } from 'react';
import { useActiveQuest } from './use-active-quest';
import type { AgentEvent } from '@code-quests/shared';

function formatEvent(event: AgentEvent): { icon: string; text: string } {
  switch (event.type) {
    case 'progress':
      return { icon: '📜', text: event.message };
    case 'combat':
      return {
        icon: '⚔',
        text: event.monsterTypeId
          ? `${event.message} (${event.monsterTypeId})`
          : event.message,
      };
    case 'status_change':
      return { icon: '🏰', text: `${event.from} → ${event.to}` };
    case 'completed':
      return { icon: '🎉', text: 'Quest complete!' };
    case 'failed':
      return { icon: '💀', text: 'Quest failed.' };
    case 'log':
      return { icon: '📋', text: event.message };
    case 'scene_change':
      return { icon: '🗺', text: `Scene: ${event.to}` };
    case 'monster_appeared':
      return { icon: '👾', text: `${event.monsterName} appeared!` };
    case 'monster_resolved':
      return { icon: '⚔', text: `Encounter ${event.outcome}.` };
    case 'paused_input':
      return { icon: '⏸', text: `Awaiting input: ${event.question}` };
    case 'resumed':
      return { icon: '▶', text: `Resumed (${event.source === 'input_response' ? 'input received' : 'user unblocked'})` };
    case 'quest_returned':
      return { icon: '🏰', text: `Quest returned to town` };
  }
}

function EventItem({ event }: { event: AgentEvent }) {
  const { icon, text } = formatEvent(event);
  const cls = `quest-event quest-event--${event.type}`;
  return (
    <li className={cls}>
      <span className="quest-event-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="quest-event-text">{text}</span>
    </li>
  );
}

export default function ActiveQuestPanel({ questId }: { questId: string }) {
  const { quest, isLoading, error, events } = useActiveQuest(questId);
  const feedRef = useRef<HTMLUListElement>(null);
  const userScrolledRef = useRef(false);

  useEffect(() => {
    if (userScrolledRef.current) return;
    const el = feedRef.current;
    if (!el) return;
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (prefersReduced) {
      el.scrollTop = el.scrollHeight;
    } else {
      el.scrollTo?.({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [events]);

  function handleScroll(): void {
    const el = feedRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
    userScrolledRef.current = !atBottom;
  }

  if (isLoading) {
    return (
      <p className="active-quest-loading" aria-live="polite" aria-busy="true">
        Loading quest…
      </p>
    );
  }

  if (error || !quest) {
    return (
      <p className="active-quest-error" role="alert">
        Could not load quest. Make sure the server is running.
      </p>
    );
  }

  return (
    <section className="active-quest-panel" aria-label="Active quest progress">
      <h3 className="active-quest-title">{quest.title}</h3>
      <p className="active-quest-status-row">
        <span className="active-quest-status-label">Status:</span>{' '}
        <span className={`active-quest-status active-quest-status--${quest.status}`}>
          {quest.status}
        </span>
      </p>

      {events.length === 0 && quest.status === 'active' && (
        <p className="active-quest-awaiting">Awaiting adventurer updates…</p>
      )}

      <ul
        ref={feedRef}
        className="active-quest-feed"
        aria-live="polite"
        aria-label="Quest event feed"
        onScroll={handleScroll}
      >
        {events.map((event, i) => (
          <EventItem key={i} event={event} />
        ))}
      </ul>

      {quest.status === 'complete' && (
        <div className="active-quest-complete-banner" role="status" aria-live="polite">
          <span aria-hidden="true">🎉</span> Quest complete!
        </div>
      )}

      {quest.status === 'failed' && (
        <div className="active-quest-failed-banner" role="alert" aria-live="assertive">
          <span aria-hidden="true">💀</span> Quest failed.
          {quest.failureSummary && (
            <p className="active-quest-failure-reason">{quest.failureSummary.reason}</p>
          )}
        </div>
      )}
    </section>
  );
}
