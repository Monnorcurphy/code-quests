import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Adventurer } from '@code-quests/shared';

interface AutoMatchPreviewProps {
  questId: string;
  adventurers: Adventurer[];
  adventurersLoading?: boolean;
  selectedAdventurerId: string | null;
  onSelectAdventurer: (id: string | null) => void;
}

export default function AutoMatchPreview({
  questId,
  adventurers,
  adventurersLoading = false,
  selectedAdventurerId,
  onSelectAdventurer,
}: AutoMatchPreviewProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['quest-auto-match', questId],
    queryFn: () => api.quests.autoMatch(questId),
  });

  // Pre-select the auto-matched adventurer when the suggestion loads
  useEffect(() => {
    if (data?.adventurerId !== undefined && selectedAdventurerId === null) {
      onSelectAdventurer(data.adventurerId);
    }
  }, [data?.adventurerId, selectedAdventurerId, onSelectAdventurer]);

  return (
    <section className="auto-match-preview" aria-label="Auto-match suggestion">
      <h4 className="auto-match-heading">Adventurer Assignment</h4>

      <div aria-live="polite" aria-atomic="true">
        {isLoading && (
          <p className="auto-match-loading" aria-busy="true">
            Finding best adventurer…
          </p>
        )}
      </div>

      {error && (
        <p className="auto-match-error" role="alert">
          Could not load suggestion. Select an adventurer manually below.
        </p>
      )}

      {!isLoading && !error && data && (
        <p className="auto-match-suggestion">
          {data.adventurerName !== null ? (
            <>
              <span className="auto-match-label">Suggested:</span>{' '}
              <span className="auto-match-name">{data.adventurerName}</span>{' '}
              <span className="auto-match-reason">— {data.reason}</span>
            </>
          ) : (
            <span className="auto-match-unavailable">{data.reason}</span>
          )}
        </p>
      )}

      {!isLoading && (
        <div className="form-field auto-match-override">
          <label htmlFor="auto-match-adventurer-select">
            {!adventurersLoading && adventurers.length === 0 ? 'Adventurer' : 'Adventurer (override)'}
          </label>
          {!adventurersLoading && adventurers.length === 0 ? (
            <p className="auto-match-no-adventurers">
              No adventurers in the guild — recruit one first.
            </p>
          ) : adventurersLoading ? (
            <p className="auto-match-loading" aria-busy="true">
              Loading adventurers…
            </p>
          ) : (
            <select
              id="auto-match-adventurer-select"
              value={selectedAdventurerId ?? ''}
              onChange={(e) => onSelectAdventurer(e.target.value || null)}
              aria-describedby={data?.adventurerName ? 'auto-match-hint' : undefined}
            >
              <option value="">— Auto-select —</option>
              {adventurers.map((adv) => (
                <option key={adv.id} value={adv.id}>
                  {adv.name} ({adv.class})
                </option>
              ))}
            </select>
          )}
          {data?.adventurerName && (
            <p id="auto-match-hint" className="auto-match-hint">
              Leave on "Auto-select" to use the suggested adventurer.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
