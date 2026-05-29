import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useFocusTrap } from '../../lib/use-focus-trap';
import type { Monster } from '@code-quests/shared';

type Props = {
  monster: Monster;
  onClose: () => void;
  onSuccess: (updatedMonster: Monster) => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
};

export default function PromoteNemesisModal({ monster, onClose, onSuccess, triggerRef }: Props) {
  const [name, setName] = useState(monster.name);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();

  function handleClose() {
    triggerRef.current?.focus();
    onClose();
  }

  const panelRef = useFocusTrap(handleClose);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  const mutation = useMutation({
    mutationFn: () => api.monsters.promoteNemesis(monster.id, name !== monster.name ? name : undefined),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ['monsters'] });
      void queryClient.invalidateQueries({ queryKey: ['monster', monster.id] });
      triggerRef.current?.focus();
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
      <div ref={panelRef} className="modal-panel promote-modal">
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
              onClick={handleClose}
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
