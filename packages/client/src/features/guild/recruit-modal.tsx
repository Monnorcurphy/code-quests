import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import type { Adventurer, AdventurerClass } from '@code-quests/shared';
import { api, ApiError } from '../../lib/api';

const CLASSES: { value: AdventurerClass; label: string }[] = [
  { value: 'champion', label: 'Champion' },
  { value: 'ranger', label: 'Ranger' },
  { value: 'scout', label: 'Scout' },
  { value: 'rogue', label: 'Rogue' },
  { value: 'apprentice', label: 'Apprentice' },
];

const NameSchema = z.string().trim().min(1, 'Name is required').max(80, 'Name must be 80 characters or fewer');

interface RecruitModalProps {
  onCancel: () => void;
  onSuccess: () => void;
}

export default function RecruitModal({ onCancel, onSuccess }: RecruitModalProps) {
  const [name, setName] = useState('');
  const [adventurerClass, setAdventurerClass] = useState<AdventurerClass>('champion');
  const [nameError, setNameError] = useState<string | null>(null);

  const onSuccessRef = useRef(onSuccess);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onCancelRef.current = onCancel;
  });

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: api.adventurers.create,
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['adventurers'] });
      const prev = queryClient.getQueryData<Adventurer[]>(['adventurers']);
      const optimisticId = `optimistic-${Date.now()}`;
      const optimistic: Adventurer = {
        id: optimisticId,
        name: data.name,
        class: data.class,
        modelId: data.modelId,
        createdAt: new Date().toISOString(),
        stats: {},
        specializations: [],
        scars: [],
      };
      queryClient.setQueryData(['adventurers'], [...(prev ?? []), optimistic]);
      return { prev, optimisticId };
    },
    onSuccess: (created, _vars, ctx) => {
      queryClient.setQueryData(['adventurers'], (old: Adventurer[] | undefined) =>
        (old ?? []).map((a) => (a.id === ctx?.optimisticId ? created : a)),
      );
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(['adventurers'], ctx?.prev);
    },
  });

  // Auto-dismiss after success
  useEffect(() => {
    if (!mutation.isSuccess) return;
    const t = setTimeout(() => onSuccessRef.current(), 3000);
    return () => clearTimeout(t);
  }, [mutation.isSuccess]);

  const serverError = (() => {
    if (!mutation.error) return null;
    if (mutation.error instanceof ApiError && mutation.error.field === 'name') return null;
    return mutation.error instanceof Error
      ? mutation.error.message
      : 'Failed to recruit adventurer. Please try again.';
  })();

  const nameFieldError = (() => {
    if (nameError) return nameError;
    if (mutation.error instanceof ApiError && mutation.error.field === 'name')
      return mutation.error.message;
    return null;
  })();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNameError(null);

    const parsed = NameSchema.safeParse(name);
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message ?? 'Invalid name');
      return;
    }

    mutation.mutate({ name: parsed.data, class: adventurerClass, modelId: 'default' });
  }

  function handleNameBlur() {
    const parsed = NameSchema.safeParse(name);
    if (!parsed.success) setNameError(parsed.error.issues[0]?.message ?? 'Invalid name');
    else setNameError(null);
  }

  const isSubmitting = mutation.isPending;
  const isSuccess = mutation.isSuccess;
  const disabled = isSubmitting || isSuccess;

  return (
    <div className="recruit-form-container">
      {isSuccess && (
        <p className="recruit-success" role="status" aria-live="polite">
          Adventurer recruited! Welcome to the guild.
        </p>
      )}

      {serverError && !isSuccess && (
        <p className="recruit-error" role="alert" aria-live="assertive">
          {serverError}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate aria-label="Recruit adventurer form">
        <div className="form-field">
          <label htmlFor="recruit-name">Name</label>
          <input
            id="recruit-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            aria-describedby={nameFieldError ? 'recruit-name-error' : undefined}
            aria-invalid={nameFieldError ? 'true' : undefined}
            disabled={disabled}
            maxLength={80}
            autoFocus
          />
          {nameFieldError && (
            <p id="recruit-name-error" className="field-error" role="alert">
              {nameFieldError}
            </p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="recruit-class">Class</label>
          <select
            id="recruit-class"
            value={adventurerClass}
            onChange={(e) => setAdventurerClass(e.target.value as AdventurerClass)}
            disabled={disabled}
          >
            {CLASSES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-actions">
          <button type="submit" disabled={disabled} aria-busy={isSubmitting ? 'true' : undefined}>
            {isSubmitting ? 'Recruiting…' : 'Recruit'}
          </button>
          <button type="button" onClick={onCancelRef.current} disabled={disabled}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
