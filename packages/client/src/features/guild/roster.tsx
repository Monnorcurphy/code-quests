import type { Adventurer } from '@code-quests/shared';
import ScarList from './scar-list';

interface RosterProps {
  adventurers: Adventurer[];
  isLoading: boolean;
  error: Error | null;
  onStyle?: (adventurer: Adventurer) => void;
}

export default function Roster({ adventurers, isLoading, error, onStyle }: RosterProps) {
  if (isLoading) {
    return (
      <p className="roster-status" aria-live="polite" aria-busy="true">
        Loading adventurers…
      </p>
    );
  }

  if (error) {
    return (
      <p className="roster-status roster-error" role="alert">
        Could not load the roster. Try again later.
      </p>
    );
  }

  if (adventurers.length === 0) {
    return (
      <p className="roster-status roster-empty">
        No adventurers yet — recruit your first hero.
      </p>
    );
  }

  return (
    <ul className="roster-list" role="list" aria-label="Guild roster" tabIndex={0}>
      {adventurers.map((a) => {
        const wins = typeof a.stats['wins'] === 'number' ? a.stats['wins'] : 0;
        const losses = typeof a.stats['losses'] === 'number' ? a.stats['losses'] : 0;
        return (
          <li key={a.id} className="roster-item">
            <span className="roster-name">{a.name}</span>
            <span className="roster-class">{a.class}</span>
            <span className="roster-record" aria-label={`${wins} wins, ${losses} losses`}>
              {wins} W / {losses} L
            </span>
            {onStyle && (
              <button
                type="button"
                className="btn-secondary roster-style-btn"
                onClick={() => onStyle(a)}
                aria-label={`Customize style for ${a.name}`}
              >
                Style
              </button>
            )}
            <ScarList scars={a.scars} adventurerId={a.id} />
          </li>
        );
      })}
    </ul>
  );
}
