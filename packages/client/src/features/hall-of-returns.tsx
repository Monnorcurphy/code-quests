import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ReturnedQuest } from '../lib/api';
import { useFocusTrap } from '../lib/use-focus-trap';
import { useTownStore } from '../stores/town-store';
import ReturnedQuestDetail from './quests/returned-quest-detail';
import type { AgentEvent } from '@code-quests/shared';

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return '';
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${totalSeconds}s`;
}

function getLastLogLines(events: AgentEvent[], count: number): string[] {
  return events
    .filter((e) => e.type === 'progress' || e.type === 'log' || e.type === 'combat')
    .slice(-count)
    .map((e) => {
      if (e.type === 'combat') return `⚔ ${e.message}`;
      return e.message;
    });
}

function QuestCard({
  quest,
  onSelect,
}: {
  quest: ReturnedQuest;
  onSelect: (q: ReturnedQuest) => void;
}) {
  const events = quest.agent?.events ?? [];
  const lastLines = getLastLogLines(events, 3);
  const duration =
    quest.agent?.startedAt
      ? formatDuration(quest.agent.startedAt, quest.agent.endedAt)
      : null;
  const isComplete = quest.status === 'complete';

  return (
    <li className="return-card-item">
      <button
        className={`return-card return-card--${isComplete ? 'complete' : 'failed'}`}
        onClick={() => onSelect(quest)}
        aria-label={`View details for ${quest.title}`}
      >
        <div className="return-card-header">
          <span className="return-card-title">{quest.title}</span>
          <span
            className={`quest-badge quest-badge--${isComplete ? 'complete' : 'failed'}`}
            aria-hidden="true"
          >
            {isComplete ? 'Victory' : 'Defeat'}
          </span>
        </div>

        {quest.adventurer && (
          <p className="return-card-adventurer">
            <span className="return-card-adventurer-name">{quest.adventurer.name}</span>
            {' · '}
            <span className="return-card-adventurer-class">{quest.adventurer.class}</span>
            {duration && (
              <>
                {' · '}
                <span className="return-card-duration">{duration}</span>
              </>
            )}
          </p>
        )}

        {lastLines.length > 0 && (
          <ul className="return-card-log" aria-label="Last log entries">
            {lastLines.map((line, i) => (
              <li key={i} className="return-card-log-line">{line}</li>
            ))}
          </ul>
        )}

        {!isComplete && quest.failureSummary && (
          <p className="return-card-failure-rec">
            {quest.failureSummary.recommendation.replace(/_/g, ' ')}
          </p>
        )}
      </button>
    </li>
  );
}

function QuestColumn({
  heading,
  quests,
  onSelect,
  modifier,
}: {
  heading: string;
  quests: ReturnedQuest[];
  onSelect: (q: ReturnedQuest) => void;
  modifier: 'complete' | 'failed';
}) {
  return (
    <section
      className={`return-column return-column--${modifier}`}
      aria-labelledby={`return-col-${modifier}`}
    >
      <h3 id={`return-col-${modifier}`} className="return-column-heading">
        {heading}
        <span className="return-column-count" aria-label={`${quests.length} quests`}>
          {' '}({quests.length})
        </span>
      </h3>
      {quests.length === 0 ? (
        <p className="return-column-empty">None yet.</p>
      ) : (
        <ul className="return-card-list">
          {quests.map((q) => (
            <QuestCard key={q.id} quest={q} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function HallOfReturns() {
  const setActiveModal = useTownStore((s) => s.setActiveModal);
  const [selectedQuest, setSelectedQuest] = useState<ReturnedQuest | null>(null);
  const panelRef = useFocusTrap(() => setActiveModal(null));
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['quests', 'returned'],
    queryFn: () => api.quests.returned(),
  });

  const complete = data?.items.filter((q) => q.status === 'complete') ?? [];
  const failed = data?.items.filter((q) => q.status === 'failed') ?? [];
  const total = data?.total ?? 0;

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const first = panel.querySelector<HTMLElement>(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    first?.focus();
  }, [panelRef]);

  useEffect(() => {
    if (!selectedQuest) firstFocusableRef.current?.focus();
  }, [selectedQuest]);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hall-of-returns-title"
    >
      <div ref={panelRef} className="modal-panel hall-of-returns-panel">
        {selectedQuest ? (
          <ReturnedQuestDetail
            quest={selectedQuest}
            onBack={() => setSelectedQuest(null)}
          />
        ) : (
          <>
            <div className="hall-of-returns-header">
              <h2 id="hall-of-returns-title" className="modal-title">
                Hall of Returns
              </h2>
              <button
                ref={firstFocusableRef}
                className="btn-secondary"
                onClick={() => setActiveModal(null)}
                aria-label="Close Hall of Returns"
              >
                Close
              </button>
            </div>

            {isLoading && (
              <p className="hall-of-returns-loading" aria-busy="true" aria-live="polite">
                Loading returned quests…
              </p>
            )}

            {error && (
              <p className="hall-of-returns-error" role="alert">
                Could not load returned quests. Make sure the server is running.
              </p>
            )}

            {!isLoading && !error && total === 0 && (
              <p className="hall-of-returns-empty">
                No quests have returned yet — dispatch your first adventurer from the War Room.
              </p>
            )}

            {!isLoading && !error && total > 0 && (
              <div className="hall-of-returns-columns">
                <QuestColumn
                  heading="Victorious"
                  quests={complete}
                  onSelect={setSelectedQuest}
                  modifier="complete"
                />
                <QuestColumn
                  heading="Returned in Defeat"
                  quests={failed}
                  onSelect={setSelectedQuest}
                  modifier="failed"
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
