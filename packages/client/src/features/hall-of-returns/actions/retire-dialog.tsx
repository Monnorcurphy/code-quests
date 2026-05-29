import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { api, ApiError } from '../../../lib/api';

interface RetireDialogProps {
  questId: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RetireDialog({ questId, triggerRef, onClose, onSuccess }: RetireDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const errorId = useId();

  useEffect(() => {
    cancelBtnRef.current?.focus();
    const trigger = triggerRef.current;
    return () => {
      trigger?.focus();
    };
  }, [triggerRef]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      await api.quests.retire(questId);
      onSuccess();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not retire quest. Please try again.';
      setError(msg);
      setLoading(false);
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="action-dialog"
      >
        <h2 id={titleId} className="action-dialog-title">
          Retire Quest
        </h2>

        <p className="action-dialog-body">
          Retire this quest? This is permanent.
        </p>

        {error && (
          <p id={errorId} role="alert" aria-live="assertive" className="action-dialog-error">
            {error}
          </p>
        )}

        <div className="action-dialog-actions">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={loading}
            aria-busy={loading ? 'true' : undefined}
            className="btn-danger"
          >
            {loading ? 'Retiring…' : 'Retire'}
          </button>
        </div>
      </div>
    </div>
  );
}
