import { useNavigate } from 'react-router-dom';
import { useReturnedQuests } from './use-returned-quests';
import type { HallOfReturnsQuest } from '../../lib/api';
import type { FailureSummaryRecommendation } from '@code-quests/shared';

const RECOMMENDATION_LABELS: Record<FailureSummaryRecommendation, string> = {
  repost_with_clarification: 'Repost',
  retire: 'Retire',
  break_into_smaller: 'Break Up',
  level_up_first: 'Level Up',
  retry: 'Retry',
};

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

function SkeletonRow() {
  return (
    <li className="hall-list-row hall-list-row--skeleton" aria-hidden="true">
      <span className="hall-list-skeleton-title" />
      <span className="hall-list-skeleton-meta" />
      <span className="hall-list-skeleton-badge" />
    </li>
  );
}

interface QuestRowProps {
  quest: HallOfReturnsQuest;
  onClick: (questId: string) => void;
}

function QuestRow({ quest, onClick }: QuestRowProps) {
  const recommendation = quest.failureSummary?.recommendation;
  const recLabel = recommendation ? RECOMMENDATION_LABELS[recommendation] : null;

  return (
    <li>
      <button
        className="hall-list-row"
        onClick={() => onClick(quest.id)}
        aria-label={`${quest.title} — view post-mortem`}
      >
        <span className="hall-list-col hall-list-col--title">
          {quest.title}
        </span>

        <span className="hall-list-col hall-list-col--adventurer">
          {quest.adventurer ? (
            <>
              <span className="hall-list-adventurer-name">{quest.adventurer.name}</span>
              <span className="hall-list-adventurer-sep"> · </span>
              <span className="hall-list-adventurer-class">{quest.adventurer.class}</span>
            </>
          ) : (
            <span className="hall-list-no-adventurer">No adventurer</span>
          )}
        </span>

        <span className="hall-list-col hall-list-col--monster">
          {quest.fatalMonster ? (
            <>
              <img
                src={quest.fatalMonster.spritePath}
                alt=""
                className="hall-list-monster-sprite"
                aria-hidden="true"
                width={20}
                height={20}
              />
              <span className="hall-list-monster-name">{quest.fatalMonster.monsterName}</span>
            </>
          ) : (
            <span className="hall-list-no-monster">—</span>
          )}
        </span>

        <span className="hall-list-col hall-list-col--time">
          <time dateTime={quest.updatedAt}>{formatRelativeTime(quest.updatedAt)}</time>
        </span>

        {recLabel && (
          <span className="hall-list-col hall-list-col--badge">
            <span className={`hall-rec-badge hall-rec-badge--${recommendation}`}>{recLabel}</span>
          </span>
        )}
      </button>
    </li>
  );
}

interface ReturnedQuestListProps {
  status: 'returned_to_town' | 'complete';
}

export default function ReturnedQuestList({ status }: ReturnedQuestListProps) {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useReturnedQuests(status);

  const handleRowClick = (questId: string) => {
    navigate(`/hall-of-returns/${questId}`);
  };

  if (isLoading) {
    return (
      <ul
        className="hall-list"
        aria-label="Loading quests"
        aria-busy="true"
        aria-live="polite"
      >
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </ul>
    );
  }

  if (error) {
    return (
      <div className="hall-list-error" role="alert">
        <p className="hall-list-error-msg">
          Could not load quests. Check that the server is running.
        </p>
        <button
          className="btn-secondary"
          onClick={() => void refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <p className="hall-list-empty">
        No returned quests yet — the guild has been victorious
      </p>
    );
  }

  return (
    <ul className="hall-list" aria-label="Returned quests">
      {items.map((quest) => (
        <QuestRow key={quest.id} quest={quest} onClick={handleRowClick} />
      ))}
    </ul>
  );
}
