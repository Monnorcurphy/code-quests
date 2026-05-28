import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { DifficultyStars } from './difficulty-stars';
import type { Monster, MonsterType, MonsterEncounter } from '@code-quests/shared';

const OUTCOME_LABELS: Record<MonsterEncounter['outcome'], string> = {
  victory: 'Victory',
  defeat: 'Defeat',
  escape: 'Escape',
};

function OutcomeBadge({ outcome }: { outcome: MonsterEncounter['outcome'] }) {
  return (
    <span className={`outcome-badge outcome-badge--${outcome}`}>
      {OUTCOME_LABELS[outcome]}
    </span>
  );
}

function EncounterItem({ encounter }: { encounter: MonsterEncounter }) {
  const { data: quest } = useQuery({
    queryKey: ['quest', encounter.questId],
    queryFn: () => api.quests.get(encounter.questId),
    staleTime: 60_000,
  });

  const date = new Date(encounter.appearedAt).toLocaleDateString();
  const questTitle = quest?.title ?? `Quest ${encounter.questId.slice(0, 8)}…`;
  const logCount = encounter.combatLog.length;
  const logPreview = logCount > 0
    ? `${logCount} combat event${logCount !== 1 ? 's' : ''}`
    : 'No combat events recorded';

  return (
    <li className="encounter-item">
      <div className="encounter-item-header">
        <span className="encounter-item-quest">{questTitle}</span>
        <OutcomeBadge outcome={encounter.outcome} />
        <span className="encounter-item-date">{date}</span>
      </div>
      <p className="encounter-item-log">{logPreview}</p>
    </li>
  );
}

type PromoteModalProps = {
  monster: Monster;
  onClose: () => void;
  onSuccess: (updatedMonster: Monster) => void;
};

function PromoteNemesisModal({ monster, onClose, onSuccess }: PromoteModalProps) {
  const [name, setName] = useState(monster.name);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => api.monsters.promoteNemesis(monster.id, name !== monster.name ? name : undefined),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ['monsters'] });
      void queryClient.invalidateQueries({ queryKey: ['monster', monster.id] });
      onSuccess(updated);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="promote-modal-title"
    >
      <div className="modal-panel promote-modal">
        <h3 id="promote-modal-title" className="modal-title">Promote to Nemesis</h3>
        <p className="modal-body">
          This will mark <strong>{monster.name}</strong> as a guild Nemesis — a recurring
          adversary that follows your guild across all projects.
        </p>

        <form onSubmit={handleSubmit} className="promote-form">
          <div className="form-field">
            <label htmlFor="nemesis-name" className="form-label">Nemesis name</label>
            <input
              id="nemesis-name"
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
              aria-describedby={error ? 'promote-error' : undefined}
            />
          </div>

          {error && (
            <p id="promote-error" role="alert" className="form-error">
              {error}
            </p>
          )}

          <div
            className="form-actions"
            aria-live="polite"
            aria-busy={mutation.isPending}
          >
            <button
              ref={cancelRef}
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={mutation.isPending || name.trim().length === 0}
              aria-label={mutation.isPending ? 'Promoting…' : 'Confirm promotion to Nemesis'}
            >
              {mutation.isPending ? 'Promoting…' : 'Mark as Nemesis'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type Props = {
  monster: Monster;
  monsterType: MonsterType | undefined;
  onBack: () => void;
};

export default function MonsterDetail({ monster: initialMonster, monsterType, onBack }: Props) {
  const [currentMonster, setCurrentMonster] = useState(initialMonster);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    data: encounters,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['monster-encounters', currentMonster.id],
    queryFn: () => api.monsters.listEncounters(currentMonster.id),
  });

  function handlePromoteSuccess(updated: Monster) {
    setCurrentMonster(updated);
    setShowPromoteModal(false);
    setSuccessMessage(`${updated.name} is now a guild Nemesis.`);
    setTimeout(() => setSuccessMessage(null), 4000);
  }

  return (
    <>
      <div className="monster-detail">
        <div className="monster-detail-header">
          <button type="button" className="btn-secondary monster-detail-back" onClick={onBack}>
            ← Back to Bestiary
          </button>
          <h3 className="monster-detail-name">{currentMonster.name}</h3>
          {currentMonster.scope === 'guild' && (
            <span className="nemesis-badge" aria-label="Guild Nemesis">⚔ Nemesis</span>
          )}
        </div>

        {successMessage && (
          <p role="status" aria-live="polite" className="promote-success">
            {successMessage}
          </p>
        )}

        <div className="monster-detail-stats">
          {monsterType?.spritePath && (
            <img
              src={monsterType.spritePath}
              alt={currentMonster.name}
              className="monster-detail-sprite"
            />
          )}
          <dl className="monster-detail-info">
            <div className="monster-detail-info-row">
              <dt>Type</dt>
              <dd>{monsterType?.name ?? currentMonster.typeId}</dd>
            </div>
            <div className="monster-detail-info-row">
              <dt>Scope</dt>
              <dd>{currentMonster.scope === 'guild' ? 'Guild Nemesis' : 'Project'}</dd>
            </div>
            <div className="monster-detail-info-row">
              <dt>Difficulty</dt>
              <dd><DifficultyStars value={currentMonster.calibratedDifficulty} /></dd>
            </div>
            <div className="monster-detail-info-row">
              <dt>Encounters</dt>
              <dd>{currentMonster.encounters}</dd>
            </div>
            <div className="monster-detail-info-row">
              <dt>Defeats</dt>
              <dd>{currentMonster.defeats}</dd>
            </div>
            <div className="monster-detail-info-row">
              <dt>Escapes</dt>
              <dd>{currentMonster.escapes}</dd>
            </div>
            <div className="monster-detail-info-row">
              <dt>First Seen</dt>
              <dd>{new Date(currentMonster.firstSeenAt).toLocaleDateString()}</dd>
            </div>
            <div className="monster-detail-info-row">
              <dt>Last Seen</dt>
              <dd>{new Date(currentMonster.lastSeenAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </div>

        {currentMonster.scope === 'project' && (
          <div className="monster-detail-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowPromoteModal(true)}
              aria-label={`Mark ${currentMonster.name} as guild Nemesis`}
            >
              ⚔ Mark as Nemesis
            </button>
          </div>
        )}

        <section aria-label="Encounter history" className="monster-detail-encounters">
          <h4 className="monster-detail-section-heading">Encounter History</h4>

          {isLoading && (
            <p className="building-loading" aria-live="polite" aria-busy="true">
              Loading encounters…
            </p>
          )}

          {isError && (
            <div role="alert" className="bestiary-error">
              <p>Could not load encounters. Make sure the server is running.</p>
              <button type="button" className="btn-secondary" onClick={() => { void refetch(); }}>
                Retry
              </button>
            </div>
          )}

          {encounters && encounters.length === 0 && (
            <p className="monster-detail-no-encounters">No encounter records found.</p>
          )}

          {encounters && encounters.length > 0 && (
            <ul className="encounter-list" aria-label="Encounters">
              {encounters.map((enc) => (
                <EncounterItem key={enc.id} encounter={enc} />
              ))}
            </ul>
          )}
        </section>
      </div>

      {showPromoteModal && (
        <PromoteNemesisModal
          monster={currentMonster}
          onClose={() => setShowPromoteModal(false)}
          onSuccess={handlePromoteSuccess}
        />
      )}
    </>
  );
}
