import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ScarRecord } from '@code-quests/shared';

interface ScarListProps {
  scars: ScarRecord[];
  adventurerId: string;
}

export default function ScarList({ scars, adventurerId }: ScarListProps) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const listId = `scar-list-${adventurerId}`;

  if (scars.length === 0) return null;

  return (
    <div className="scar-list">
      <button
        type="button"
        className="scar-badge"
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={() => setExpanded((prev) => !prev)}
      >
        Scars ({scars.length})
      </button>
      {expanded && (
        <ul id={listId} className="scar-entries" role="list" aria-label={`Scars for adventurer`}>
          {scars.map((scar, index) => (
            <li key={`${scar.questId}-${index}`} className="scar-entry">
              <button
                type="button"
                className="scar-link"
                onClick={() => navigate(`/hall-of-returns/${scar.questId}`)}
                aria-label={`View post-mortem: ${scar.failureSummary}`}
              >
                {scar.failureSummary}
              </button>
              <span className="scar-date" aria-label="Scar date">
                {new Date(scar.occurredAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
