import { useQuery } from '@tanstack/react-query';
import type { Quest, QuestStatus } from '@code-quests/shared';
import { api } from '../../lib/api';

const STATUS_LABELS: Record<QuestStatus, string> = {
  idle: 'Drafted',
  active: 'Active',
  complete: 'Complete',
  failed: 'Failed',
  paused_input: 'Awaiting Input',
  user_blocked: 'Blocked',
};

const STATUS_CLASS: Record<QuestStatus, string> = {
  idle: 'quest-badge quest-badge--drafted',
  active: 'quest-badge quest-badge--active',
  complete: 'quest-badge quest-badge--complete',
  failed: 'quest-badge quest-badge--failed',
  paused_input: 'quest-badge quest-badge--waiting',
  user_blocked: 'quest-badge quest-badge--blocked',
};

export default function QuestBoard() {
  const { data: rawData, isLoading, error } = useQuery({
    queryKey: ['quests'],
    queryFn: api.quests.list,
  });
  const quests: Quest[] = (rawData as Quest[] | undefined) ?? [];

  if (isLoading) {
    return (
      <p className="quest-board-status" aria-live="polite">
        Loading quests…
      </p>
    );
  }

  if (error) {
    return (
      <p className="quest-board-status quest-board-error" role="alert">
        Could not load quests. Make sure the server is running.
      </p>
    );
  }

  if (quests.length === 0) {
    return (
      <p className="quest-board-empty">
        No quests yet — visit the War Room to draft one.
      </p>
    );
  }

  return (
    <ul className="quest-board-list" role="list" aria-label="Quest board" tabIndex={0}>
      {quests.map((quest) => (
        <li key={quest.id} className="quest-board-item">
          <span className="quest-board-title">{quest.title}</span>
          <span className={STATUS_CLASS[quest.status]} aria-label={`Status: ${STATUS_LABELS[quest.status]}`}>
            {STATUS_LABELS[quest.status]}
          </span>
          {quest.acceptanceCriteria.length > 0 && (
            <span className="quest-board-ac-count">
              {quest.acceptanceCriteria.length} AC
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
