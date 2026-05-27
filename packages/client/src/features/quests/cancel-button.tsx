import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useFocusTrap } from '../../lib/use-focus-trap';

type CancelState = 'idle' | 'confirming' | 'loading' | 'success' | 'error';

export default function CancelButton({ questId }: { questId: string }) {
  const [state, setState] = useState<CancelState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepGoingBtnRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useFocusTrap(handleAbortCancel);
  const queryClient = useQueryClient();

  const { mutate } = useMutation({
    mutationFn: () => api.quests.cancel(questId),
    onMutate: () => {
      setState('loading');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['quest', questId] });
      void queryClient.invalidateQueries({ queryKey: ['quests'] });
      setState('success');
      successTimerRef.current = setTimeout(() => setState('idle'), 3000);
    },
    onError: (err) => {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to cancel quest');
      setState('error');
    },
  });

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (state === 'confirming') {
      keepGoingBtnRef.current?.focus();
    }
  }, [state]);

  function handleAbortCancel(): void {
    setState('idle');
  }

  function handleRequestCancel(): void {
    setErrorMsg(null);
    setState('confirming');
  }

  function handleConfirmCancel(): void {
    mutate();
  }

  if (state === 'success') {
    return (
      <div aria-live="polite" aria-atomic="true">
        <p className="cancel-success" role="status">
          Quest cancelled.
        </p>
      </div>
    );
  }

  return (
    <div className="cancel-section" aria-label="Cancel quest controls">
      {state === 'error' && errorMsg && (
        <p className="cancel-error" role="alert">
          {errorMsg}
        </p>
      )}

      {state === 'confirming' && (
        <div
          ref={confirmRef}
          className="cancel-confirm-panel"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="cancel-confirm-title"
        >
          <h4 id="cancel-confirm-title" className="cancel-confirm-title">
            Abandon this quest?
          </h4>
          <p className="cancel-confirm-body">
            The adventurer will be recalled and this quest marked as failed. This cannot be
            undone.
          </p>
          <div className="cancel-confirm-actions">
            <button
              ref={keepGoingBtnRef}
              type="button"
              className="btn-secondary"
              onClick={handleAbortCancel}
            >
              Keep going
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={handleConfirmCancel}
            >
              Abandon quest
            </button>
          </div>
        </div>
      )}

      {(state === 'idle' || state === 'error') && (
        <button
          type="button"
          className="btn-secondary cancel-btn"
          onClick={handleRequestCancel}
        >
          Cancel quest
        </button>
      )}

      {state === 'loading' && (
        <button
          type="button"
          className="btn-secondary cancel-btn"
          disabled
          aria-busy="true"
        >
          Cancelling…
        </button>
      )}
    </div>
  );
}
