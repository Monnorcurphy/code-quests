import { useQuery } from '@tanstack/react-query';
import type { Quest } from '@code-quests/shared';
import { api } from '../../lib/api';
import { useTownStore } from '../../stores/town-store';
import { useActiveProjectStore } from '../../stores/active-project-store';

interface Props {
  // Statuses the picker accepts. The Oracle / Tavern / Armory only let you
  // prep idle quests (acceptance criteria & equipment lock once dispatched),
  // but the same control can be reused for other rooms with different rules.
  allowedStatuses?: Quest['status'][];
  // Label shown above the dropdown. Defaults to a generic prompt.
  label?: string;
  // Optional href for the "no quests yet" empty-state link.
  draftHref?: string;
  onDraftClick?: () => void;
}

const DEFAULT_STATUSES: Quest['status'][] = ['idle'];

export default function QuestSelector({
  allowedStatuses = DEFAULT_STATUSES,
  label = 'Prepare which quest?',
  onDraftClick,
}: Props) {
  const selectedQuestId = useTownStore((s) => s.selectedQuestId);
  const setSelectedQuestId = useTownStore((s) => s.setSelectedQuestId);
  const activeProjectId = useActiveProjectStore((s) => s.activeProjectId);

  const { data: quests, isLoading, error } = useQuery({
    queryKey: ['quests'],
    queryFn: api.quests.list,
  });

  if (isLoading) {
    return (
      <p className="quest-selector-status" aria-live="polite" aria-busy="true">
        Loading quests…
      </p>
    );
  }

  if (error) {
    return (
      <p className="quest-selector-status quest-selector-error" role="alert">
        Could not load quests. Make sure the server is running.
      </p>
    );
  }

  const all = quests ?? [];
  const eligible = all.filter((q) => allowedStatuses.includes(q.status));
  // If the user has an active project, scope to its quests so the picker
  // doesn't surface unrelated work from other projects. Quests with no
  // project (legacy rows) are shown too so they don't disappear.
  const scoped = activeProjectId
    ? eligible.filter((q) => q.projectId === activeProjectId || q.projectId === null)
    : eligible;

  if (scoped.length === 0) {
    return (
      <div className="quest-selector quest-selector--empty">
        <p className="quest-selector-empty-text">
          No quests ready to prepare. Draft one in the War Room first.
        </p>
        {onDraftClick && (
          <button type="button" className="btn-secondary" onClick={onDraftClick}>
            Go to War Room
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="quest-selector">
      <label className="quest-selector-label" htmlFor="quest-selector-input">
        {label}
      </label>
      <select
        id="quest-selector-input"
        className="quest-selector-input"
        value={selectedQuestId ?? ''}
        onChange={(e) => setSelectedQuestId(e.target.value === '' ? null : e.target.value)}
      >
        <option value="">— pick a quest —</option>
        {scoped.map((q) => (
          <option key={q.id} value={q.id}>
            {q.title}
          </option>
        ))}
      </select>
    </div>
  );
}
