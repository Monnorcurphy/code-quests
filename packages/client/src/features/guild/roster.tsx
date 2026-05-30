import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Adventurer } from '@code-quests/shared';
import { api, ApiError } from '../../lib/api';
import ScarList from './scar-list';

interface RosterProps {
  adventurers: Adventurer[];
  isLoading: boolean;
  error: Error | null;
  onStyle?: (adventurer: Adventurer) => void;
}

export default function Roster({ adventurers, isLoading, error, onStyle }: RosterProps) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null);

  const dismissMutation = useMutation({
    mutationFn: (id: string) => api.adventurers.delete(id),
    onSuccess: async () => {
      setConfirming(null);
      setDeleteError(null);
      await queryClient.invalidateQueries({ queryKey: ['adventurers'] });
    },
    onError: (err, id) => {
      const message =
        err instanceof ApiError ? err.message : 'Could not dismiss this adventurer.';
      setDeleteError({ id, message });
    },
  });
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
        const isConfirming = confirming === a.id;
        const isDeleting = dismissMutation.isPending && dismissMutation.variables === a.id;
        const showError = deleteError?.id === a.id;
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
            {isConfirming ? (
              <span className="roster-dismiss-confirm" role="group" aria-label={`Confirm dismiss ${a.name}`}>
                <span className="roster-dismiss-prompt">Dismiss?</span>
                <button
                  type="button"
                  className="btn-danger roster-dismiss-btn"
                  onClick={() => dismissMutation.mutate(a.id)}
                  disabled={isDeleting}
                  aria-label={`Confirm dismiss ${a.name}`}
                >
                  {isDeleting ? 'Dismissing…' : 'Confirm'}
                </button>
                <button
                  type="button"
                  className="btn-secondary roster-dismiss-btn"
                  onClick={() => {
                    setConfirming(null);
                    setDeleteError(null);
                  }}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="btn-secondary roster-dismiss-btn"
                onClick={() => {
                  setConfirming(a.id);
                  setDeleteError(null);
                }}
                aria-label={`Dismiss ${a.name} from the guild`}
              >
                Dismiss
              </button>
            )}
            <ScarList scars={a.scars} adventurerId={a.id} />
            {showError && (
              <p className="roster-dismiss-error" role="alert">
                {deleteError.message}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
