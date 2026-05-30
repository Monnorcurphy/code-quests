import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { AC_MAX_COUNT, AC_MAX_LENGTH } from '@code-quests/shared';
import { useFocusTrap } from '../lib/use-focus-trap';
import { useTownStore } from '../stores/town-store';
import { api } from '../lib/api';
import QuestSelector from './quest-selector/quest-selector';

const MAX_ACS = AC_MAX_COUNT;
const AcItemSchema = z
  .string()
  .trim()
  .min(1, 'Criterion cannot be empty')
  .max(AC_MAX_LENGTH, 'Criterion must be 500 characters or fewer');

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

function AcList({
  acs,
  acErrors,
  onChange,
  onBlur,
  onRemove,
  disabled,
}: {
  acs: string[];
  acErrors: (string | null)[];
  onChange: (idx: number, val: string) => void;
  onBlur: (idx: number) => void;
  onRemove: (idx: number) => void;
  disabled: boolean;
}) {
  return (
    <ul className="ac-list" aria-label="Acceptance criteria list">
      {acs.map((ac, idx) => (
        <li key={idx} className="ac-row">
          <input
            type="text"
            value={ac}
            onChange={(e) => onChange(idx, e.target.value)}
            onBlur={() => onBlur(idx)}
            aria-label={`Criterion ${idx + 1}`}
            aria-describedby={acErrors[idx] ? `oracle-ac-err-${idx}` : undefined}
            aria-invalid={acErrors[idx] ? 'true' : undefined}
            maxLength={500}
            className="ac-input"
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => onRemove(idx)}
            aria-label={`Remove criterion ${idx + 1}`}
            className="ac-remove-btn"
            disabled={disabled || acs.length === 1}
          >
            ×
          </button>
          {acErrors[idx] && (
            <p id={`oracle-ac-err-${idx}`} className="field-error ac-error" role="alert">
              {acErrors[idx]}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function Oracle() {
  const setActiveModal = useTownStore((s) => s.setActiveModal);
  const selectedQuestId = useTownStore((s) => s.selectedQuestId);

  const panelRef = useFocusTrap(() => setActiveModal(null));

  const { data: quest, isLoading, error } = useQuery({
    queryKey: ['quest', selectedQuestId],
    queryFn: () => api.quests.get(selectedQuestId!),
    enabled: selectedQuestId !== null,
  });

  const [acs, setAcs] = useState<string[]>(['']);
  const [acErrors, setAcErrors] = useState<(string | null)[]>([null]);
  const [initialized, setInitialized] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (newAcs: string[]) =>
      api.quests.patch(selectedQuestId!, { acceptanceCriteria: newAcs }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['quest', selectedQuestId] });
      void queryClient.invalidateQueries({ queryKey: ['quests'] });
    },
  });

  useEffect(() => {
    if (quest && !initialized) {
      const criteria = quest.acceptanceCriteria ?? [];
      const initial = criteria.length > 0 ? criteria : [''];
      setAcs(initial);
      setAcErrors(new Array(initial.length).fill(null) as null[]);
      setInitialized(true);
    }
  }, [quest, initialized]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const focusedRef = useRef(false);
  useEffect(() => {
    if (focusedRef.current) return;
    const panel = panelRef.current;
    if (!panel) return;
    const first = panel.querySelector<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled])',
    );
    if (first) {
      first.focus();
      focusedRef.current = true;
    }
  }, [panelRef, quest]);

  function handleChange(idx: number, value: string) {
    setAcs((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }

  function handleBlur(idx: number) {
    const val = acs[idx] ?? '';
    const parsed = AcItemSchema.safeParse(val);
    setAcErrors((prev) => {
      const next = [...prev];
      next[idx] = parsed.success ? null : (parsed.error.issues[0]?.message ?? 'Invalid');
      return next;
    });
  }

  function handleRemove(idx: number) {
    setAcs((prev) => prev.filter((_, i) => i !== idx));
    setAcErrors((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleAdd() {
    if (acs.length >= MAX_ACS) return;
    setAcs((prev) => [...prev, '']);
    setAcErrors((prev) => [...prev, null]);
  }

  async function handleSave() {
    const errs = acs.map((ac) => {
      const parsed = AcItemSchema.safeParse(ac);
      return parsed.success ? null : (parsed.error.issues[0]?.message ?? 'Invalid');
    });
    if (errs.some((e) => e !== null)) {
      setAcErrors(errs);
      return;
    }
    const filledAcs = acs.filter((ac) => ac.trim());
    setSaveStatus('saving');
    setSaveError('');
    try {
      await mutation.mutateAsync(filledAcs);
      setSaveStatus('success');
      timerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e) {
      setSaveStatus('error');
      setSaveError(e instanceof Error ? e.message : 'Failed to save. Please try again.');
    }
  }

  const isLocked = quest !== undefined && quest.status !== 'idle';
  const isSaving = saveStatus === 'saving';

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="oracle-title">
      <div ref={panelRef} className="modal-panel oracle-panel">
        <h2 id="oracle-title" className="modal-title">
          Oracle — Acceptance Criteria
        </h2>

        {!selectedQuestId ? (
          <>
            <QuestSelector
              label="Sharpen which quest's acceptance criteria?"
              onDraftClick={() => setActiveModal('draft')}
            />
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setActiveModal(null)}>
                Close
              </button>
            </div>
          </>
        ) : isLoading ? (
          <p className="building-loading" aria-live="polite" aria-busy="true">
            Loading quest…
          </p>
        ) : error || !quest ? (
          <p className="building-load-error" role="alert">
            Could not load quest. Make sure the server is running.
          </p>
        ) : (
          <>
            <p className="building-quest-name">{quest.title}</p>

            {isLocked ? (
              <>
                <p className="building-locked" role="status">
                  This quest has been dispatched — acceptance criteria are locked.
                </p>
                <ul className="ac-list ac-list--locked" aria-label="Acceptance criteria (locked)">
                  {(quest.acceptanceCriteria ?? []).map((ac, idx) => (
                    <li key={idx} className="ac-row-locked">
                      <span className="ac-locked-text">{ac}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <fieldset className="form-fieldset" disabled={isSaving}>
                  <legend className="form-legend">Edit Acceptance Criteria</legend>
                  <AcList
                    acs={acs}
                    acErrors={acErrors}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onRemove={handleRemove}
                    disabled={isSaving}
                  />
                  <button
                    type="button"
                    onClick={handleAdd}
                    className="ac-add-btn btn-secondary"
                    disabled={isSaving || acs.length >= MAX_ACS}
                    aria-label={acs.length >= MAX_ACS ? 'Maximum 15 criteria reached' : 'Add criterion'}
                  >
                    + Add Criterion
                  </button>
                </fieldset>

                <div aria-live="polite" aria-atomic="true" className="building-status">
                  {saveStatus === 'success' && (
                    <p className="building-save-success" role="status">
                      Criteria saved!
                    </p>
                  )}
                </div>

                {saveStatus === 'error' && (
                  <p className="building-save-error" role="alert">
                    {saveError}
                  </p>
                )}
              </>
            )}

            <div className="form-actions">
              {!isLocked && (
                <button
                  className="btn-primary"
                  onClick={() => { void handleSave(); }}
                  disabled={isSaving}
                  aria-busy={isSaving}
                >
                  {isSaving ? 'Saving…' : 'Save Criteria'}
                </button>
              )}
              <button className="btn-secondary" onClick={() => setActiveModal('draft')}>
                ← Back to War Room
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
