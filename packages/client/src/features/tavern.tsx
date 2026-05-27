import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { AC_MAX_COUNT, AC_MAX_LENGTH } from '@code-quests/shared';
import { useFocusTrap } from '../lib/use-focus-trap';
import { useTownStore } from '../stores/town-store';
import { api } from '../lib/api';

const MAX_EDGE_CASES = AC_MAX_COUNT;
const EdgeCaseSchema = z
  .string()
  .trim()
  .min(1, 'Edge case cannot be empty')
  .max(AC_MAX_LENGTH, 'Edge case must be 500 characters or fewer');

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

function EdgeCaseList({
  items,
  errors,
  onChange,
  onBlur,
  onRemove,
  disabled,
}: {
  items: string[];
  errors: (string | null)[];
  onChange: (idx: number, val: string) => void;
  onBlur: (idx: number) => void;
  onRemove: (idx: number) => void;
  disabled: boolean;
}) {
  return (
    <ul className="ac-list" aria-label="Edge cases list">
      {items.map((item, idx) => (
        <li key={idx} className="ac-row">
          <input
            type="text"
            value={item}
            onChange={(e) => onChange(idx, e.target.value)}
            onBlur={() => onBlur(idx)}
            aria-label={`Edge case ${idx + 1}`}
            aria-describedby={errors[idx] ? `tavern-ec-err-${idx}` : undefined}
            aria-invalid={errors[idx] ? 'true' : undefined}
            maxLength={500}
            className="ac-input"
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => onRemove(idx)}
            aria-label={`Remove edge case ${idx + 1}`}
            className="ac-remove-btn"
            disabled={disabled || items.length === 1}
          >
            ×
          </button>
          {errors[idx] && (
            <p id={`tavern-ec-err-${idx}`} className="field-error ac-error" role="alert">
              {errors[idx]}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function Tavern() {
  const setActiveModal = useTownStore((s) => s.setActiveModal);
  const selectedQuestId = useTownStore((s) => s.selectedQuestId);

  const panelRef = useFocusTrap(() => setActiveModal(null));

  const { data: quest, isLoading, error } = useQuery({
    queryKey: ['quest', selectedQuestId],
    queryFn: () => api.quests.get(selectedQuestId!),
    enabled: selectedQuestId !== null,
  });

  const [items, setItems] = useState<string[]>(['']);
  const [errors, setErrors] = useState<(string | null)[]>([null]);
  const [initialized, setInitialized] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (newItems: string[]) =>
      api.quests.patch(selectedQuestId!, { edgeCases: newItems }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['quest', selectedQuestId] });
      void queryClient.invalidateQueries({ queryKey: ['quests'] });
    },
  });

  useEffect(() => {
    if (quest && !initialized) {
      const edgeCases = quest.edgeCases ?? [];
      const initial = edgeCases.length > 0 ? edgeCases : [''];
      setItems(initial);
      setErrors(new Array(initial.length).fill(null) as null[]);
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
    setItems((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }

  function handleBlur(idx: number) {
    const val = items[idx] ?? '';
    const parsed = EdgeCaseSchema.safeParse(val);
    setErrors((prev) => {
      const next = [...prev];
      next[idx] = parsed.success ? null : (parsed.error.issues[0]?.message ?? 'Invalid');
      return next;
    });
  }

  function handleRemove(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setErrors((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleAdd() {
    if (items.length >= MAX_EDGE_CASES) return;
    setItems((prev) => [...prev, '']);
    setErrors((prev) => [...prev, null]);
  }

  async function handleSave() {
    const errs = items.map((item) => {
      const parsed = EdgeCaseSchema.safeParse(item);
      return parsed.success ? null : (parsed.error.issues[0]?.message ?? 'Invalid');
    });
    if (errs.some((e) => e !== null)) {
      setErrors(errs);
      return;
    }
    const filled = items.filter((item) => item.trim());
    setSaveStatus('saving');
    setSaveError('');
    try {
      await mutation.mutateAsync(filled);
      setSaveStatus('success');
      timerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e) {
      setSaveStatus('error');
      setSaveError(e instanceof Error ? e.message : 'Failed to save. Please try again.');
    }
  }

  const isSaving = saveStatus === 'saving';

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="tavern-title">
      <div ref={panelRef} className="modal-panel tavern-panel">
        <h2 id="tavern-title" className="modal-title">
          Tavern — Edge Cases
        </h2>

        {!selectedQuestId ? (
          <>
            <p className="modal-body">No quest selected. Select a quest from the Quest Board first.</p>
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
            <p className="modal-body">
              Discuss potential failure modes and record edge cases here.
            </p>

            <fieldset className="form-fieldset" disabled={isSaving}>
              <legend className="form-legend">Edit Edge Cases</legend>
              <EdgeCaseList
                items={items}
                errors={errors}
                onChange={handleChange}
                onBlur={handleBlur}
                onRemove={handleRemove}
                disabled={isSaving}
              />
              <button
                type="button"
                onClick={handleAdd}
                className="ac-add-btn btn-secondary"
                disabled={isSaving || items.length >= MAX_EDGE_CASES}
                aria-label={items.length >= MAX_EDGE_CASES ? 'Maximum 15 edge cases reached' : 'Add edge case'}
              >
                + Add Edge Case
              </button>
            </fieldset>

            <div aria-live="polite" aria-atomic="true" className="building-status">
              {saveStatus === 'success' && (
                <p className="building-save-success" role="status">
                  Edge cases saved!
                </p>
              )}
            </div>

            {saveStatus === 'error' && (
              <p className="building-save-error" role="alert">
                {saveError}
              </p>
            )}

            <div className="form-actions">
              <button
                className="btn-primary"
                onClick={() => { void handleSave(); }}
                disabled={isSaving}
                aria-busy={isSaving}
              >
                {isSaving ? 'Saving…' : 'Save Edge Cases'}
              </button>
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
