import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { useTourStore } from '../../stores/tour-store';

const MODAL_FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus the Cancel button on mount — safest action for a destructive confirm
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // Escape dismisses + Tab focus trap
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (!loading) onCancel();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const els = Array.from(panel.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE));
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel, loading]);

  return (
    <div
      className="modal-backdrop showcase-confirm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="showcase-confirm-title"
      data-testid="showcase-confirm-modal"
    >
      <div ref={panelRef} className="modal-panel showcase-confirm-panel">
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
            ref={cancelRef}
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
  const triggerRef = useRef<HTMLButtonElement>(null);

  if (!isDemoMode()) return null;

  function handleClick() {
    setError(null);
    setModalState('confirm');
  }

  function handleCancel() {
    setModalState('hidden');
    setError(null);
    triggerRef.current?.focus();
  }

  async function handleConfirm() {
    setModalState('loading');
    setError(null);
    try {
      await api.showcase.reset();
      setModalState('hidden');
      startTour();
      triggerRef.current?.focus();
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
          ref={triggerRef}
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
