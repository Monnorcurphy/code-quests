import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { api, ApiError } from '../../../lib/api';
import type { SplitResult } from '../../../lib/api';
import type { SplitChild } from '@code-quests/shared';

interface SplitDialogProps {
  questId: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onSuccess: (result: SplitResult) => void;
}

interface ChildStub {
  title: string;
  description: string;
  acs: string[];
}

function makeStub(): ChildStub {
  return { title: '', description: '', acs: [''] };
}

function isChildValid(c: ChildStub): boolean {
  return c.title.trim().length > 0 && c.acs.some((ac) => ac.trim().length > 0);
}

export default function SplitDialog({ questId, triggerRef, onClose, onSuccess }: SplitDialogProps) {
  const [children, setChildren] = useState<ChildStub[]>([makeStub(), makeStub()]);
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
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled])',
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

  function updateChild(idx: number, update: Partial<ChildStub>) {
    setChildren((prev) => prev.map((c, i) => (i === idx ? { ...c, ...update } : c)));
  }

  function updateAc(childIdx: number, acIdx: number, val: string) {
    setChildren((prev) =>
      prev.map((c, i) => {
        if (i !== childIdx) return c;
        const newAcs = [...c.acs];
        newAcs[acIdx] = val;
        return { ...c, acs: newAcs };
      }),
    );
  }

  function addAc(childIdx: number) {
    setChildren((prev) =>
      prev.map((c, i) => (i === childIdx ? { ...c, acs: [...c.acs, ''] } : c)),
    );
  }

  function removeAc(childIdx: number, acIdx: number) {
    setChildren((prev) =>
      prev.map((c, i) => {
        if (i !== childIdx) return c;
        return { ...c, acs: c.acs.filter((_, j) => j !== acIdx) };
      }),
    );
  }

  function addChild() {
    setChildren((prev) => [...prev, makeStub()]);
  }

  function removeChild(idx: number) {
    if (children.length <= 2) return;
    setChildren((prev) => prev.filter((_, i) => i !== idx));
  }

  const validChildren = children.filter(isChildValid);
  const isSubmitDisabled = loading || validChildren.length < 2;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitDisabled) return;
    setLoading(true);
    setError(null);
    try {
      const payload: SplitChild[] = validChildren.map((c) => ({
        title: c.title.trim(),
        description: c.description.trim(),
        acceptanceCriteria: c.acs.filter((ac) => ac.trim().length > 0),
      }));
      const result = await api.quests.split(questId, payload);
      onSuccess(result);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not split quest. Please try again.';
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
        className="action-dialog action-dialog--split"
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        <h2 id={titleId} className="action-dialog-title">
          Break into Smaller Quests
        </h2>

        {error && (
          <p id={errorId} role="alert" aria-live="assertive" className="action-dialog-error">
            {error}
          </p>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          {children.map((child, childIdx) => (
            <section
              key={childIdx}
              aria-label={`Child quest ${childIdx + 1}`}
              className="split-child"
            >
              <div className="split-child-header">
                <h3 className="split-child-heading">Quest {childIdx + 1}</h3>
                {children.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeChild(childIdx)}
                    disabled={loading}
                    aria-label={`Remove quest ${childIdx + 1}`}
                    className="split-child-remove"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="form-field">
                <label htmlFor={`split-title-${childIdx}`} className="form-label">
                  Title
                </label>
                <input
                  ref={childIdx === 0 ? firstInputRef : undefined}
                  id={`split-title-${childIdx}`}
                  type="text"
                  value={child.title}
                  onChange={(e) => updateChild(childIdx, { title: e.target.value })}
                  maxLength={200}
                  disabled={loading}
                  className="form-input"
                  aria-required="true"
                />
              </div>

              <div className="form-field">
                <label htmlFor={`split-desc-${childIdx}`} className="form-label">
                  Description
                </label>
                <textarea
                  id={`split-desc-${childIdx}`}
                  value={child.description}
                  onChange={(e) => updateChild(childIdx, { description: e.target.value })}
                  disabled={loading}
                  rows={2}
                  className="form-textarea"
                />
              </div>

              <fieldset disabled={loading}>
                <legend className="form-legend">Acceptance Criteria</legend>
                <ul aria-label={`Acceptance criteria for quest ${childIdx + 1}`} className="ac-list">
                  {child.acs.map((ac, acIdx) => (
                    <li key={acIdx} className="ac-row">
                      <input
                        type="text"
                        value={ac}
                        onChange={(e) => updateAc(childIdx, acIdx, e.target.value)}
                        aria-label={`Criterion ${acIdx + 1} for quest ${childIdx + 1}`}
                        maxLength={500}
                        className="ac-input"
                      />
                      <button
                        type="button"
                        onClick={() => removeAc(childIdx, acIdx)}
                        aria-label={`Remove criterion ${acIdx + 1} for quest ${childIdx + 1}`}
                        className="ac-remove-btn"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => addAc(childIdx)}
                  className="ac-add-btn btn-secondary"
                >
                  + Add Criterion
                </button>
              </fieldset>
            </section>
          ))}

          <button
            type="button"
            onClick={addChild}
            disabled={loading}
            className="btn-secondary split-add-child"
          >
            + Add Quest
          </button>

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
              {loading ? 'Splitting…' : `Split into ${Math.max(validChildren.length, 2)} Quests`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
