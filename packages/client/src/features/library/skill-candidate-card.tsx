import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Skill, MonsterType } from '@code-quests/shared';

type ActionState = 'idle' | 'confirming' | 'confirming-loading' | 'dismissing' | 'success';

export default function SkillCandidateCard({
  skill,
  monsterTypes,
}: {
  skill: Skill;
  monsterTypes: MonsterType[];
}) {
  const queryClient = useQueryClient();
  const [actionState, setActionState] = useState<ActionState>('idle');
  const [nameInput, setNameInput] = useState(skill.name);
  const [implInput, setImplInput] = useState(skill.implementation);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const targetTypes = monsterTypes.filter((t) => skill.monsterTypeIds.includes(t.id));

  function scheduleQueryRefresh() {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: ['skills'] });
    }, 3000);
  }

  function handleConfirmOpen() {
    setNameInput(skill.name);
    setImplInput(skill.implementation);
    setNameError(null);
    setError(null);
    setActionState('confirming');
  }

  function handleConfirmCancel() {
    setNameError(null);
    setError(null);
    setActionState('idle');
  }

  async function handleConfirmSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setNameError('Skill name is required');
      return;
    }
    setNameError(null);
    setError(null);
    setActionState('confirming-loading');
    try {
      await api.skills.confirmCandidate(skill.id, { name: trimmed, implementation: implInput });
      setSuccessMsg('Skill confirmed!');
      setActionState('success');
      scheduleQueryRefresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to confirm skill';
      setError(msg);
      setActionState('confirming');
    }
  }

  async function handleDismiss() {
    setError(null);
    setActionState('dismissing');
    try {
      await api.skills.dismissCandidate(skill.id);
      setSuccessMsg('Skill dismissed.');
      setActionState('success');
      scheduleQueryRefresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to dismiss skill';
      setError(msg);
      setActionState('idle');
    }
  }

  if (actionState === 'success') {
    return (
      <div
        className="skill-candidate-card skill-candidate-card--success"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <p className="skill-candidate-success-msg">{successMsg}</p>
      </div>
    );
  }

  const isLoading = actionState === 'confirming-loading' || actionState === 'dismissing';

  return (
    <article className="skill-candidate-card" aria-label={`Skill candidate: ${skill.name}`}>
      <div className="skill-candidate-type-row">
        {targetTypes.length > 0
          ? targetTypes.map((t) => (
              <span key={t.id} className="skill-type-chip">
                {t.spritePath && <img src={t.spritePath} alt="" className="skill-type-sprite" />}
                {t.name}
              </span>
            ))
          : <span className="skill-type-chip">{skill.monsterTypeIds[0] ?? 'Unknown type'}</span>
        }
      </div>

      <p className="skill-candidate-hit-count">
        Detected {skill.hitCount} {skill.hitCount === 1 ? 'time' : 'times'}
      </p>

      {(actionState === 'idle' || actionState === 'dismissing') && (
        <>
          <p className="skill-candidate-name">{skill.name}</p>
          {error && (
            <div role="alert" className="skill-candidate-error">
              <p>{error}</p>
              <button
                type="button"
                className="skill-candidate-error-dismiss"
                aria-label="Dismiss error"
                onClick={() => setError(null)}
              >
                ×
              </button>
            </div>
          )}
          <div className="skill-candidate-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={handleConfirmOpen}
              disabled={isLoading}
              aria-label={`Confirm skill: ${skill.name}`}
            >
              Confirm Skill
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void handleDismiss()}
              disabled={isLoading}
              aria-busy={actionState === 'dismissing' ? 'true' : 'false'}
              aria-label={`Dismiss skill: ${skill.name}`}
            >
              {actionState === 'dismissing' ? 'Dismissing…' : 'Dismiss'}
            </button>
          </div>
        </>
      )}

      {(actionState === 'confirming' || actionState === 'confirming-loading') && (
        <form
          className="skill-confirm-form"
          onSubmit={(e) => void handleConfirmSubmit(e)}
          aria-label={`Confirm skill form for ${skill.name}`}
        >
          <div className="form-field">
            <label htmlFor={`skill-name-${skill.id}`}>Skill name</label>
            <input
              id={`skill-name-${skill.id}`}
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              disabled={actionState === 'confirming-loading'}
              aria-invalid={nameError ? 'true' : 'false'}
              aria-describedby={nameError ? `skill-name-err-${skill.id}` : undefined}
            />
            {nameError && (
              <p id={`skill-name-err-${skill.id}`} className="field-error" role="alert">
                {nameError}
              </p>
            )}
          </div>
          <div className="form-field">
            <label htmlFor={`skill-impl-${skill.id}`}>Implementation note (optional)</label>
            <textarea
              id={`skill-impl-${skill.id}`}
              className="library-textarea"
              value={implInput}
              onChange={(e) => setImplInput(e.target.value)}
              disabled={actionState === 'confirming-loading'}
              rows={3}
            />
          </div>
          {error && (
            <div role="alert" className="skill-candidate-error">
              <p>{error}</p>
            </div>
          )}
          <div className="form-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={actionState === 'confirming-loading'}
              aria-busy={actionState === 'confirming-loading' ? 'true' : 'false'}
            >
              {actionState === 'confirming-loading' ? 'Confirming…' : 'Confirm'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleConfirmCancel}
              disabled={actionState === 'confirming-loading'}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </article>
  );
}
