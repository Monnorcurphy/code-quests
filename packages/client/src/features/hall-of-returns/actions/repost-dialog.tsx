import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { api, ApiError } from '../../../lib/api';
import type { HallOfReturnsQuest, RepostResult } from '../../../lib/api';

interface RepostDialogProps {
  questId: string;
  quest: HallOfReturnsQuest;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onSuccess: (result: RepostResult) => void;
}

export default function RepostDialog({ questId, quest, triggerRef, onClose, onSuccess }: RepostDialogProps) {
  const [acs, setAcs] = useState<string[]>(
    quest.acceptanceCriteria.length > 0 ? [...quest.acceptanceCriteria] : [''],
  );
  const [edgeCases, setEdgeCases] = useState<string[]>(
    quest.edgeCases.length > 0 ? [...quest.edgeCases] : [''],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const errorId = useId();

  useEffect(() => {
    firstInputRef.current?.focus();
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
        'button:not([disabled]), input:not([disabled])',
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

  function handleAcChange(idx: number, val: string) {
    setAcs((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  }

  function handleRemoveAc(idx: number) {
    setAcs((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleAddAc() {
    setAcs((prev) => [...prev, '']);
  }

  function handleEdgeCaseChange(idx: number, val: string) {
    setEdgeCases((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  }

  function handleRemoveEdgeCase(idx: number) {
    setEdgeCases((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleAddEdgeCase() {
    setEdgeCases((prev) => [...prev, '']);
  }

  const filledAcs = acs.filter((ac) => ac.trim().length > 0);
  const isSubmitDisabled = loading || filledAcs.length === 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitDisabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.quests.repost(questId, {
        acceptanceCriteria: filledAcs,
        edgeCases: edgeCases.filter((ec) => ec.trim().length > 0),
      });
      onSuccess(result);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not re-post quest. Please try again.';
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
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        <h2 id={titleId} className="action-dialog-title">
          Re-post Quest
        </h2>

        {error && (
          <p id={errorId} role="alert" aria-live="assertive" className="action-dialog-error">
            {error}
          </p>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <fieldset disabled={loading}>
            <legend className="action-dialog-legend">Acceptance Criteria</legend>
            <ul aria-label="Acceptance criteria" className="ac-list">
              {acs.map((ac, idx) => (
                <li key={idx} className="ac-row">
                  <input
                    ref={idx === 0 ? firstInputRef : undefined}
                    type="text"
                    value={ac}
                    onChange={(e) => handleAcChange(idx, e.target.value)}
                    aria-label={`Criterion ${idx + 1}`}
                    maxLength={500}
                    className="ac-input"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveAc(idx)}
                    aria-label={`Remove criterion ${idx + 1}`}
                    className="ac-remove-btn"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={handleAddAc} className="ac-add-btn btn-secondary">
              + Add Criterion
            </button>
          </fieldset>

          <fieldset disabled={loading}>
            <legend className="action-dialog-legend">Edge Cases</legend>
            <ul aria-label="Edge cases" className="ac-list">
              {edgeCases.map((ec, idx) => (
                <li key={idx} className="ac-row">
                  <input
                    type="text"
                    value={ec}
                    onChange={(e) => handleEdgeCaseChange(idx, e.target.value)}
                    aria-label={`Edge case ${idx + 1}`}
                    maxLength={500}
                    className="ac-input"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveEdgeCase(idx)}
                    aria-label={`Remove edge case ${idx + 1}`}
                    className="ac-remove-btn"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={handleAddEdgeCase} className="ac-add-btn btn-secondary">
              + Add Edge Case
            </button>
          </fieldset>

          <div className="action-dialog-actions">
            <button type="button" onClick={onClose} disabled={loading} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              aria-busy={loading ? 'true' : undefined}
              className="btn-primary"
            >
              {loading ? 'Posting…' : 'Re-post Quest'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
