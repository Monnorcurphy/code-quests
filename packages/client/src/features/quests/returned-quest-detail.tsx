import { useEffect, useRef } from 'react';
import type { ReturnedQuest } from '../../lib/api';
import type { AgentEvent } from '@code-quests/shared';

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return 'Unknown duration';
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatEventText(event: AgentEvent): string {
  switch (event.type) {
    case 'progress': return event.message;
    case 'combat':
      return event.monsterTypeId
        ? `⚔ ${event.message} (${event.monsterTypeId})`
        : `⚔ ${event.message}`;
    case 'status_change': return `Status: ${event.from} → ${event.to}`;
    case 'completed': return '🎉 Quest completed!';
    case 'failed': return `💀 Quest failed${event.reason ? `: ${event.reason}` : ''}`;
    case 'log': return event.message;
    case 'scene_change': return `🗺 Scene: ${event.to}`;
    case 'monster_appeared': return `👾 ${event.monsterName} appeared!`;
    case 'monster_resolved': return `⚔ Encounter ${event.outcome}.`;
    case 'paused_input': return `⏸ Awaiting input: ${event.question}`;
    case 'resumed': return `▶ Resumed (${event.source === 'input_response' ? 'input received' : 'user unblocked'})`;
  }
}

const RECOMMENDATION_LABELS: Record<string, string> = {
  retry: 'Retry — attempt again with same parameters',
  repost_with_clarification: 'Repost with clarification — refine the quest description',
  retire: 'Retire — this quest should not be attempted again',
};

interface ReturnedQuestDetailProps {
  quest: ReturnedQuest;
  onBack: () => void;
}

export default function ReturnedQuestDetail({ quest, onBack }: ReturnedQuestDetailProps) {
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const events = quest.agent?.events ?? [];
  const duration =
    quest.agent?.startedAt
      ? formatDuration(quest.agent.startedAt, quest.agent.endedAt)
      : null;

  useEffect(() => {
    backButtonRef.current?.focus();
  }, []);

  return (
    <div className="return-detail">
      <div className="return-detail-header">
        <button
          ref={backButtonRef}
          className="btn-secondary return-detail-back"
          onClick={onBack}
          aria-label="Back to Hall of Returns"
        >
          ← Back
        </button>
        <h3 id="return-detail-title" className="return-detail-title">
          {quest.title}
        </h3>
        <span
          className={`quest-badge quest-badge--${quest.status === 'complete' ? 'complete' : 'failed'}`}
          aria-label={quest.status === 'complete' ? 'Victorious' : 'Returned in defeat'}
        >
          {quest.status === 'complete' ? 'Victorious' : 'Defeated'}
        </span>
      </div>

      {quest.adventurer && (
        <p className="return-detail-adventurer">
          <span className="return-detail-adventurer-name">{quest.adventurer.name}</span>
          {' · '}
          <span className="return-detail-adventurer-class">{quest.adventurer.class}</span>
          {duration && (
            <>
              {' · '}
              <span className="return-detail-duration">{duration}</span>
            </>
          )}
        </p>
      )}

      {quest.status === 'failed' && quest.failureSummary && (
        <div className="return-detail-failure">
          <p className="return-detail-failure-reason">
            <strong>Why it failed:</strong> {quest.failureSummary.reason}
          </p>
          <p className="return-detail-failure-rec">
            <strong>Recommendation:</strong>{' '}
            {RECOMMENDATION_LABELS[quest.failureSummary.recommendation] ??
              quest.failureSummary.recommendation}
          </p>
        </div>
      )}

      <section aria-labelledby="return-detail-log-heading" className="return-detail-log-section">
        <h4 id="return-detail-log-heading" className="return-detail-log-heading">
          Combat Log
        </h4>
        {events.length === 0 ? (
          <p className="return-detail-log-empty">No events recorded for this quest.</p>
        ) : (
          <ol className="return-detail-log" aria-label="Quest event log">
            {events.map((event, i) => (
              <li key={i} className={`return-detail-log-item return-detail-log-item--${event.type}`}>
                {formatEventText(event)}
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="return-detail-phase9-note" aria-label="Future features">
        <p>
          <strong>Re-post</strong> and <strong>Retire</strong> actions are coming in Phase 9.
        </p>
      </div>
    </div>
  );
}
