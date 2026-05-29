import { useState } from 'react';
import type { MonsterEncounter } from '@code-quests/shared';

const OUTCOME_LABELS: Record<MonsterEncounter['outcome'], string> = {
  victory: 'Victory',
  defeat: 'Defeat',
  escape: 'Escape',
};

interface EncounterRowProps {
  encounter: MonsterEncounter;
  index: number;
}

function EncounterRow({ encounter, index }: EncounterRowProps) {
  const [expanded, setExpanded] = useState(false);
  const monsterName = encounter.monsterName ?? 'Unknown Monster';
  const outcome = encounter.outcome;
  const outcomeLabel = OUTCOME_LABELS[outcome];
  const combatLog = encounter.combatLog;
  const hasCombatLog = combatLog.length > 0;

  return (
    <li
      className={`combat-log-entry combat-log-entry--${outcome}`}
      aria-label={`Encounter ${index + 1}: ${monsterName} — ${outcomeLabel}`}
    >
      <div className="combat-log-entry-header">
        {encounter.spritePath && (
          <img
            src={encounter.spritePath}
            alt=""
            aria-hidden="true"
            className="combat-log-entry-sprite"
            width={24}
            height={24}
          />
        )}
        <span className="combat-log-entry-name">{monsterName}</span>
        {encounter.difficulty !== undefined && (
          <span
            className="combat-log-entry-difficulty"
            aria-label={`Difficulty ${encounter.difficulty} out of 5`}
          >
            {'★'.repeat(encounter.difficulty)}
            {'☆'.repeat(5 - encounter.difficulty)}
          </span>
        )}
        <span className={`combat-log-entry-outcome combat-log-entry-outcome--${outcome}`}>
          {outcomeLabel}
        </span>
        {hasCombatLog && (
          <button
            type="button"
            className="combat-log-entry-toggle btn-secondary"
            aria-expanded={expanded}
            aria-controls={`combat-log-lines-${encounter.id}`}
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? 'Hide details' : 'Show details'}
          </button>
        )}
      </div>
      {hasCombatLog && (
        <ul
          id={`combat-log-lines-${encounter.id}`}
          className="combat-log-lines"
          hidden={!expanded}
        >
          {combatLog.map((line, i) => (
            <li key={i} className="combat-log-line">
              {String(line)}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

interface CombatLogReplayProps {
  encounters: MonsterEncounter[];
}

export default function CombatLogReplay({ encounters }: CombatLogReplayProps) {
  if (encounters.length === 0) {
    return (
      <section aria-labelledby="combat-log-heading" className="combat-log-section">
        <h3 id="combat-log-heading" className="combat-log-heading">Combat Log</h3>
        <p className="combat-log-empty">No encounters recorded for this quest.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="combat-log-heading" className="combat-log-section">
      <h3 id="combat-log-heading" className="combat-log-heading">Combat Log</h3>
      <ol className="combat-log-list" aria-label="Monster encounters">
        {encounters.map((enc, i) => (
          <EncounterRow key={enc.id} encounter={enc} index={i} />
        ))}
      </ol>
    </section>
  );
}
