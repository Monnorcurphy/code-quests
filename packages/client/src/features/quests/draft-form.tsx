import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import type { Epic } from '@code-quests/shared';
import { api } from '../../lib/api';
import { useActiveProjectStore } from '../../stores/active-project-store';
import ProjectPickerModal from '../projects/project-picker-modal';
import { useProjects } from '../projects/use-projects';
import { useModels } from '../models/use-models';
import { useTownStore } from '../../stores/town-store';

const TitleSchema = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(200, 'Title must be 200 characters or fewer');

const AcItemSchema = z
  .string()
  .trim()
  .min(1, 'Criterion cannot be empty')
  .max(500, 'Criterion must be 500 characters or fewer');

interface DraftFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function DraftForm({ onSuccess, onCancel }: DraftFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [acs, setAcs] = useState<string[]>(['']);
  const [epicId, setEpicId] = useState<string>('');
  const [modelId, setModelId] = useState<string>('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [acErrors, setAcErrors] = useState<(string | null)[]>([null]);
  const [newEpicOpen, setNewEpicOpen] = useState(false);
  const [newEpicTitle, setNewEpicTitle] = useState('');
  const [newEpicGoal, setNewEpicGoal] = useState('');
  const [newEpicError, setNewEpicError] = useState<string | null>(null);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);

  const activeProjectId = useActiveProjectStore((s) => s.activeProjectId);
  const { data: projectsData } = useProjects();
  const activeProject = (projectsData ?? []).find((p) => p.id === activeProjectId) ?? null;
  // If the persisted active id no longer matches any project (e.g. deleted on
  // another tab), treat the draft as project-less.
  const effectiveProjectId = activeProject ? activeProjectId : null;

  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });

  const queryClient = useQueryClient();

  const { data: rawEpics } = useQuery({
    queryKey: ['epics'],
    queryFn: api.epics.list,
  });
  const epics: Epic[] = (rawEpics as Epic[] | undefined) ?? [];

  const { data: rawModels } = useModels();
  const models = rawModels ?? [];
  // Default to the most-recently-used model when none is picked yet.
  useEffect(() => {
    if (!modelId && models.length > 0) {
      setModelId(models[0]!.id);
    }
  }, [modelId, models]);
  const setActiveModal = useTownStore((s) => s.setActiveModal);

  const mutation = useMutation({
    mutationFn: api.quests.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quests'] });
    },
  });

  const epicMutation = useMutation({
    mutationFn: api.epics.create,
    onSuccess: (epic) => {
      queryClient.invalidateQueries({ queryKey: ['epics'] });
      setEpicId(epic.id);
      setNewEpicOpen(false);
      setNewEpicTitle('');
      setNewEpicGoal('');
      setNewEpicError(null);
    },
    onError: (err) => {
      setNewEpicError(
        err instanceof Error ? err.message : 'Failed to create epic',
      );
    },
  });

  useEffect(() => {
    if (!mutation.isSuccess) return;
    const t = setTimeout(() => onSuccessRef.current(), 3000);
    return () => clearTimeout(t);
  }, [mutation.isSuccess]);

  function handleAddAc() {
    setAcs((prev) => [...prev, '']);
    setAcErrors((prev) => [...prev, null]);
  }

  function handleRemoveAc(idx: number) {
    setAcs((prev) => prev.filter((_, i) => i !== idx));
    setAcErrors((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleAcChange(idx: number, value: string) {
    setAcs((prev) => {
      const updated = [...prev];
      updated[idx] = value;
      return updated;
    });
  }

  function handleAcBlur(idx: number) {
    const val = acs[idx] ?? '';
    if (!val.trim()) {
      setAcErrors((prev) => {
        const updated = [...prev];
        updated[idx] = null;
        return updated;
      });
      return;
    }
    const parsed = AcItemSchema.safeParse(val);
    setAcErrors((prev) => {
      const updated = [...prev];
      updated[idx] = parsed.success ? null : (parsed.error.issues[0]?.message ?? 'Invalid');
      return updated;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsedTitle = TitleSchema.safeParse(title);
    if (!parsedTitle.success) {
      setTitleError(parsedTitle.error.issues[0]?.message ?? 'Invalid title');
      return;
    }
    setTitleError(null);

    const filledAcs = acs.filter((ac) => ac.trim());
    const acValidations = filledAcs.map((ac) => AcItemSchema.safeParse(ac));
    if (acValidations.some((r) => !r.success)) {
      const updated = acs.map((ac) => {
        if (!ac.trim()) return null;
        const r = AcItemSchema.safeParse(ac);
        return r.success ? null : (r.error.issues[0]?.message ?? 'Invalid');
      });
      setAcErrors(updated);
      return;
    }

    mutation.mutate({
      title: parsedTitle.data,
      description: description || undefined,
      acceptanceCriteria: filledAcs,
      epicId: epicId || null,
      projectId: effectiveProjectId,
      modelId: modelId || null,
    });
  }

  const serverError = (() => {
    if (!mutation.error) return null;
    return mutation.error instanceof Error
      ? mutation.error.message
      : 'Failed to create quest. Please try again.';
  })();

  const isSubmitting = mutation.isPending;
  const isSuccess = mutation.isSuccess;
  const disabled = isSubmitting || isSuccess;

  return (
    <div className="draft-form-container">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {isSubmitting ? 'Submitting…' : ''}
      </p>

      {!effectiveProjectId && (
        <div
          role="region"
          aria-label="No active project"
          data-testid="no-project-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 12px',
            marginBottom: 12,
            background: '#fbe6c4',
            border: '1px solid #a06a18',
            borderLeft: '4px solid #7a1818',
            borderRadius: 4,
            color: '#5a3818',
          }}
        >
          <span>
            <strong>Pick a project before drafting a quest.</strong> Your agent
            will run inside the folder you choose.
          </span>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setProjectPickerOpen(true)}
          >
            Choose project
          </button>
        </div>
      )}
      {effectiveProjectId && activeProject && (
        <p
          data-testid="active-project-summary"
          style={{
            margin: '0 0 12px',
            fontSize: '0.85rem',
            color: '#5a3818',
          }}
        >
          Working in <strong>{activeProject.name}</strong>{' '}
          <span style={{ fontStyle: 'italic' }}>({activeProject.path})</span>.
        </p>
      )}
      {projectPickerOpen && <ProjectPickerModal onClose={() => setProjectPickerOpen(false)} />}

      {isSuccess && (
        <p className="recruit-success" role="status" aria-live="polite">
          Quest drafted! It now appears on the Quest Board.
        </p>
      )}

      {serverError && !isSuccess && (
        <p className="recruit-error" role="alert" aria-live="assertive">
          {serverError}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate aria-label="Draft quest form">
        <div className="form-field">
          <label htmlFor="quest-title">Title</label>
          <input
            id="quest-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              const p = TitleSchema.safeParse(title);
              setTitleError(p.success ? null : (p.error.issues[0]?.message ?? 'Invalid'));
            }}
            aria-describedby={titleError ? 'quest-title-error' : undefined}
            aria-invalid={titleError ? 'true' : undefined}
            disabled={disabled}
            maxLength={200}
            autoFocus
          />
          {titleError && (
            <p id="quest-title-error" className="field-error" role="alert">
              {titleError}
            </p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="quest-description">Description</label>
          <textarea
            id="quest-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={disabled}
            rows={3}
            className="form-textarea"
          />
        </div>

        <fieldset className="form-fieldset" disabled={disabled}>
          <legend className="form-legend">Acceptance Criteria</legend>
          <ul className="ac-list" aria-label="Acceptance criteria list">
            {acs.map((ac, idx) => (
              <li key={idx} className="ac-row">
                <input
                  type="text"
                  value={ac}
                  onChange={(e) => handleAcChange(idx, e.target.value)}
                  onBlur={() => handleAcBlur(idx)}
                  aria-label={`Criterion ${idx + 1}`}
                  aria-describedby={acErrors[idx] ? `ac-error-${idx}` : undefined}
                  aria-invalid={acErrors[idx] ? 'true' : undefined}
                  maxLength={500}
                  className="ac-input"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveAc(idx)}
                  aria-label={`Remove criterion ${idx + 1}`}
                  className="ac-remove-btn"
                  disabled={acs.length === 1}
                >
                  ×
                </button>
                {acErrors[idx] && (
                  <p id={`ac-error-${idx}`} className="field-error ac-error" role="alert">
                    {acErrors[idx]}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <button type="button" onClick={handleAddAc} className="ac-add-btn btn-secondary">
            + Add Criterion
          </button>
        </fieldset>

        <div className="form-field">
          <label htmlFor="quest-epic">Epic (optional)</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              id="quest-epic"
              value={epicId}
              onChange={(e) => setEpicId(e.target.value)}
              disabled={disabled}
              style={{ flex: 1 }}
            >
              <option value="">— None —</option>
              {epics.map((epic) => (
                <option key={epic.id} value={epic.id}>
                  {epic.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setNewEpicOpen((v) => !v)}
              disabled={disabled}
              aria-expanded={newEpicOpen}
              aria-controls="new-epic-form"
            >
              {newEpicOpen ? 'Cancel new epic' : '+ New Epic'}
            </button>
          </div>
          {newEpicOpen && (
            <div
              id="new-epic-form"
              style={{
                marginTop: 8,
                padding: 12,
                border: '1px solid #b5a07a',
                borderRadius: 4,
                background: '#f5ecd6',
              }}
            >
              <div className="form-field">
                <label htmlFor="new-epic-title">Epic title</label>
                <input
                  id="new-epic-title"
                  type="text"
                  value={newEpicTitle}
                  onChange={(e) => setNewEpicTitle(e.target.value)}
                  disabled={epicMutation.isPending}
                  maxLength={200}
                  placeholder="e.g. Auth Migration"
                />
              </div>
              <div className="form-field">
                <label htmlFor="new-epic-goal">Goal</label>
                <textarea
                  id="new-epic-goal"
                  value={newEpicGoal}
                  onChange={(e) => setNewEpicGoal(e.target.value)}
                  disabled={epicMutation.isPending}
                  rows={2}
                  placeholder="What this epic accomplishes"
                />
              </div>
              {newEpicError && (
                <p role="alert" style={{ color: '#a00', fontSize: '0.85rem', margin: '4px 0' }}>
                  {newEpicError}
                </p>
              )}
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setNewEpicError(null);
                  const t = newEpicTitle.trim();
                  const g = newEpicGoal.trim();
                  if (!t) return setNewEpicError('Epic title is required');
                  if (!g) return setNewEpicError('Goal is required');
                  epicMutation.mutate({ title: t, goal: g });
                }}
                disabled={epicMutation.isPending}
              >
                {epicMutation.isPending ? 'Creating…' : 'Create Epic'}
              </button>
            </div>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="quest-model">Model</label>
          {models.length === 0 ? (
            <div
              data-testid="no-models-banner"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, padding: '10px 12px',
                background: '#fbe6c4', border: '1px solid #a06a18',
                borderLeft: '4px solid #7a1818', borderRadius: 4, color: '#5a3818',
              }}
            >
              <span>
                <strong>No models configured.</strong> Add one in Settings → Models so an
                adventurer has something to think with.
              </span>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setActiveModal('models')}
              >
                Open Models
              </button>
            </div>
          ) : (
            <select
              id="quest-model"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              disabled={disabled}
              data-testid="quest-model-select"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.provider} · {m.modelId}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn-primary"
            disabled={disabled}
            aria-busy={isSubmitting ? 'true' : undefined}
          >
            {isSubmitting ? 'Drafting…' : 'Draft Quest'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={disabled}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
