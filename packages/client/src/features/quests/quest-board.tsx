import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { Quest, QuestStatus } from '@code-quests/shared';
import { api } from '../../lib/api';
import { useTownStore } from '../../stores/town-store';

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

function AuditBadge({ quest }: { quest: Quest }) {
  if (quest.specAudit === null) return null;
  if (quest.specAudit.gaps.length === 0) {
    return (
      <span className="quest-audit-badge quest-audit-badge--pass" aria-label="Audit: all checks pass">
        ✓ Ready
      </span>
    );
  }
  return (
    <span
      className="quest-audit-badge quest-audit-badge--gaps"
      aria-label={`Audit: ${quest.specAudit.gaps.length} gap${quest.specAudit.gaps.length === 1 ? '' : 's'}`}
    >
      ⚠ {quest.specAudit.gaps.length} {quest.specAudit.gaps.length === 1 ? 'gap' : 'gaps'}
    </span>
  );
}

export default function QuestBoard() {
  const navigate = useNavigate();
  const setSelectedQuestId = useTownStore((s) => s.setSelectedQuestId);
  const setActiveModal = useTownStore((s) => s.setActiveModal);

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

  function openQuestDetail(quest: Quest) {
    setSelectedQuestId(quest.id);
    setActiveModal('draft');
  }

  return (
    <ul className="quest-board-list" role="list" aria-label="Quest board" tabIndex={0}>
      {quests.map((quest) => (
        <li key={quest.id} className="quest-board-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="quest-board-item-btn"
            onClick={() => openQuestDetail(quest)}
            aria-label={`View quest: ${quest.title}`}
          >
            <span className="quest-board-title">{quest.title}</span>
            <span
              className={STATUS_CLASS[quest.status as QuestStatus]}
              aria-label={`Status: ${STATUS_LABELS[quest.status as QuestStatus]}`}
            >
              {STATUS_LABELS[quest.status as QuestStatus]}
            </span>
            {quest.acceptanceCriteria.length > 0 && (
              <span className="quest-board-ac-count">
                {quest.acceptanceCriteria.length} AC
              </span>
            )}
            <AuditBadge quest={quest} />
          </button>
          {quest.status === 'active' && (
            <button
              type="button"
              className="btn-primary enter-quest-btn"
              onClick={() => navigate(`/quest/${quest.id}`)}
              aria-label={`Enter quest: ${quest.title}`}
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Enter Quest
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
