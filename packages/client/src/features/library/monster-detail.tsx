import { useQuery } from '@tanstack/react-query';
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

type Props = {
  monster: Monster;
  monsterType: MonsterType | undefined;
  onBack: () => void;
};

export default function MonsterDetail({ monster, monsterType, onBack }: Props) {
  const {
    data: encounters,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['monster-encounters', monster.id],
    queryFn: () => api.monsters.listEncounters(monster.id),
  });

  return (
    <div className="monster-detail">
      <div className="monster-detail-header">
        <button type="button" className="btn-secondary monster-detail-back" onClick={onBack}>
          ← Back to Bestiary
        </button>
        <h3 className="monster-detail-name">{monster.name}</h3>
      </div>

      <div className="monster-detail-stats">
        {monsterType?.spritePath && (
          <img
            src={monsterType.spritePath}
            alt={monster.name}
            className="monster-detail-sprite"
          />
        )}
        <dl className="monster-detail-info">
          <div className="monster-detail-info-row">
            <dt>Type</dt>
            <dd>{monsterType?.name ?? monster.typeId}</dd>
          </div>
          <div className="monster-detail-info-row">
            <dt>Difficulty</dt>
            <dd><DifficultyStars value={monster.calibratedDifficulty} /></dd>
          </div>
          <div className="monster-detail-info-row">
            <dt>Encounters</dt>
            <dd>{monster.encounters}</dd>
          </div>
          <div className="monster-detail-info-row">
            <dt>Defeats</dt>
            <dd>{monster.defeats}</dd>
          </div>
          <div className="monster-detail-info-row">
            <dt>Escapes</dt>
            <dd>{monster.escapes}</dd>
          </div>
          <div className="monster-detail-info-row">
            <dt>First Seen</dt>
            <dd>{new Date(monster.firstSeenAt).toLocaleDateString()}</dd>
          </div>
          <div className="monster-detail-info-row">
            <dt>Last Seen</dt>
            <dd>{new Date(monster.lastSeenAt).toLocaleDateString()}</dd>
          </div>
        </dl>
      </div>

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
  );
}
