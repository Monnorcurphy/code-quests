import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useFocusTrap } from '../../lib/use-focus-trap';
import type { MonsterType } from '@code-quests/shared';

type Props = {
  preselectedTypeId?: string;
  onClose: () => void;
  onSuccess: (skillName: string) => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
};

export default function ForgeSkillModal({ preselectedTypeId, onClose, onSuccess, triggerRef }: Props) {
  const queryClient = useQueryClient();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>(
    preselectedTypeId ? [preselectedTypeId] : [],
  );
  const [implementation, setImplementation] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: monsterTypes = [] } = useQuery({
    queryKey: ['monster-types'],
    queryFn: () => api.monsters.listTypes(),
  });

  function handleClose() {
    triggerRef.current?.focus();
    onClose();
  }

  const panelRef = useFocusTrap(handleClose);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  function validateName(value: string): string | null {
    const trimmed = value.trim();
    if (trimmed.length === 0) return 'Name is required.';
    if (trimmed.length > 80) return 'Name must be 80 characters or fewer.';
    return null;
  }

  function handleNameBlur() {
    setNameError(validateName(name));
  }

  function toggleType(id: string) {
    setSelectedTypeIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  const isSubmitDisabled =
    isSubmitting || selectedTypeIds.length === 0 || name.trim().length === 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateName(name);
    if (err) {
      setNameError(err);
      return;
    }
    setNameError(null);
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const skill = await api.skills.forge({
        name: name.trim(),
        monsterTypeIds: selectedTypeIds,
        implementation,
      });
      void queryClient.invalidateQueries({ queryKey: ['skills'] });
      setSuccessMsg(`Skill '${skill.name}' forged!`);
      setTimeout(() => {
        onSuccess(skill.name);
        handleClose();
      }, 3000);
    } catch (err: unknown) {
      setIsSubmitting(false);
      if (
        err !== null &&
        typeof err === 'object' &&
        'field' in err &&
        (err as { field?: string }).field === 'name'
      ) {
        setNameError((err as { message?: string }).message ?? 'Invalid name.');
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to forge skill.';
        setSubmitError(msg);
      }
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="forge-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div ref={panelRef} className="modal-panel forge-skill-modal">
        <h3 id="forge-modal-title" className="modal-title">⚒ Forge a Skill</h3>

        <form onSubmit={(e) => { void handleSubmit(e); }} noValidate>
          {/* Name */}
          <div className="form-field">
            <label htmlFor="forge-name" className="form-label">
              Name <span aria-hidden="true">*</span>
            </label>
            <input
              id="forge-name"
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => { setName(e.target.value); if (nameError) setNameError(null); }}
              onBlur={handleNameBlur}
              maxLength={80}
              required
              aria-required="true"
              aria-describedby={nameError ? 'forge-name-error' : undefined}
              aria-invalid={nameError !== null ? 'true' : 'false'}
              disabled={isSubmitting}
            />
            {nameError && (
              <p id="forge-name-error" role="alert" className="field-error">
                {nameError}
              </p>
            )}
          </div>

          {/* Monster Types */}
          <fieldset className="form-fieldset" disabled={isSubmitting}>
            <legend className="form-label">
              Counters monsters of type <span aria-hidden="true">*</span>
            </legend>
            {monsterTypes.length === 0 ? (
              <p className="forge-types-empty">Loading monster types…</p>
            ) : (
              <div className="forge-types-list" role="group" aria-label="Monster types">
                {monsterTypes.map((mt: MonsterType) => (
                  <label key={mt.id} className="forge-type-option">
                    <input
                      type="checkbox"
                      value={mt.id}
                      checked={selectedTypeIds.includes(mt.id)}
                      onChange={() => toggleType(mt.id)}
                    />
                    <span>{mt.name}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          {/* Implementation */}
          <div className="form-field">
            <label htmlFor="forge-impl" className="form-label">
              Implementation note <span className="form-label-optional">(optional)</span>
            </label>
            <textarea
              id="forge-impl"
              className="form-textarea"
              value={implementation}
              onChange={(e) => setImplementation(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="How does this skill defeat the monster? E.g. 'run pnpm lint --fix and re-run failing rules'."
              disabled={isSubmitting}
            />
          </div>

          {/* Success */}
          {successMsg && (
            <p role="status" aria-live="polite" className="forge-success">
              {successMsg}
            </p>
          )}

          {/* Submit error */}
          {submitError && (
            <p role="alert" aria-live="assertive" className="form-error">
              {submitError}
            </p>
          )}

          <div className="form-actions" aria-live="polite" aria-busy={isSubmitting}>
            <button
              ref={cancelRef}
              type="button"
              className="btn-secondary"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitDisabled}
              aria-label={isSubmitting ? 'Forging skill…' : 'Forge skill'}
            >
              {isSubmitting ? 'Forging…' : '⚒ Forge Skill'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
