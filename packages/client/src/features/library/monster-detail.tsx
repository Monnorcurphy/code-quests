import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { DifficultyStars } from './difficulty-stars';
import ForgeSkillModal from './forge-skill-modal';
import PromoteNemesisModal from './promote-nemesis-modal';
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

export default function MonsterDetail({ monster: initialMonster, monsterType, onBack }: Props) {
  const [currentMonster, setCurrentMonster] = useState(initialMonster);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showForgeModal, setShowForgeModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const promoteButtonRef = useRef<HTMLButtonElement>(null);
  const forgeButtonRef = useRef<HTMLButtonElement>(null);

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

  function handleForgeSuccess(skillName: string) {
    setSuccessMessage(`Skill '${skillName}' added to your guild's library.`);
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

        <div className="monster-detail-actions">
          {currentMonster.scope === 'project' && (
            <button
              ref={promoteButtonRef}
              type="button"
              className="btn-primary"
              onClick={() => setShowPromoteModal(true)}
              aria-label={`Mark ${currentMonster.name} as guild Nemesis`}
            >
              ⚔ Mark as Nemesis
            </button>
          )}
          <button
            ref={forgeButtonRef}
            type="button"
            className="btn-secondary"
            onClick={() => setShowForgeModal(true)}
            aria-label={`Forge a skill that counters ${currentMonster.name}`}
          >
            ⚒ Forge Skill
          </button>
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

      {showPromoteModal && (
        <PromoteNemesisModal
          monster={currentMonster}
          onClose={() => setShowPromoteModal(false)}
          onSuccess={handlePromoteSuccess}
          triggerRef={promoteButtonRef}
        />
      )}

      {showForgeModal && (
        <ForgeSkillModal
          preselectedTypeId={currentMonster.typeId}
          onClose={() => setShowForgeModal(false)}
          onSuccess={handleForgeSuccess}
          triggerRef={forgeButtonRef}
        />
      )}
    </>
  );
}
