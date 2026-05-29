import { useState } from 'react';
import { api } from '../../lib/api';
import { useTourStore } from '../../stores/tour-store';

// Demo mode: true when server started with CODE_QUESTS_ENV=demo (baked in at Vite startup)
// or when window.__DEMO_MODE__ is set (used by E2E tests).
function isDemoMode(): boolean {
  if (import.meta.env.VITE_CODE_QUESTS_ENV === 'demo') return true;
  if (typeof window !== 'undefined') {
    return !!(window as unknown as Record<string, unknown>)['__DEMO_MODE__'];
  }
  return false;
}

type ModalState = 'hidden' | 'confirm' | 'loading' | 'error';

interface ConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  error: string | null;
  loading: boolean;
}

function ConfirmModal({ onConfirm, onCancel, error, loading }: ConfirmModalProps) {
  return (
    <div
      className="modal-backdrop showcase-confirm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="showcase-confirm-title"
      data-testid="showcase-confirm-modal"
    >
      <div className="modal-panel showcase-confirm-panel">
        <h2 id="showcase-confirm-title" className="modal-title">
          Start Showcase Demo?
        </h2>
        <p className="modal-body">
          This will reset your database to the showcase scenario (Modernize the Auth System epic
          with three adventurers). Any existing data will be preserved for the showcase quests only.
        </p>
        {error && (
          <p className="showcase-confirm-error" role="alert" aria-live="assertive">
            {error}
          </p>
        )}
        <div className="showcase-confirm-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? 'Resetting…' : 'Start Demo'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ShowcaseButton() {
  const [modalState, setModalState] = useState<ModalState>('hidden');
  const [error, setError] = useState<string | null>(null);
  const startTour = useTourStore((s) => s.startTour);

  if (!isDemoMode()) return null;

  function handleClick() {
    setError(null);
    setModalState('confirm');
  }

  function handleCancel() {
    setModalState('hidden');
    setError(null);
  }

  async function handleConfirm() {
    setModalState('loading');
    setError(null);
    try {
      await api.showcase.reset();
      setModalState('hidden');
      startTour();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Reset failed. Please try again.';
      setError(message);
      setModalState('error');
    }
  }

  return (
    <>
      <div className="showcase-button-wrapper" data-testid="showcase-button-wrapper">
        <span className="showcase-demo-ribbon" aria-hidden="true">
          Demo
        </span>
        <button
          type="button"
          className="btn-primary showcase-start-btn"
          onClick={handleClick}
          data-testid="showcase-start-btn"
        >
          Start Showcase Demo
        </button>
      </div>

      {(modalState === 'confirm' || modalState === 'loading' || modalState === 'error') && (
        <ConfirmModal
          onConfirm={() => void handleConfirm()}
          onCancel={handleCancel}
          error={error}
          loading={modalState === 'loading'}
        />
      )}
    </>
  );
}
