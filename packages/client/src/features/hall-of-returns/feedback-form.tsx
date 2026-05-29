import { useState, useId } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';

interface FeedbackFormProps {
  questId: string;
}

const MAX_CHARS = 2000;

export default function FeedbackForm({ questId }: FeedbackFormProps) {
  const [text, setText] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fieldId = useId();
  const counterId = `${fieldId}-counter`;
  const errorId = `${fieldId}-error`;

  const mutation = useMutation({
    mutationFn: () => api.quests.submitFeedback(questId, text),
    onSuccess: () => {
      setText('');
      setErrorMessage(null);
      setSuccessMessage('Feedback saved successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (err: unknown) => {
      let msg = 'Could not save feedback. Please try again.';
      if (err instanceof ApiError && err.field) {
        msg = `${err.field}: ${err.message}`;
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setErrorMessage(msg);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length === 0) return;
    setErrorMessage(null);
    mutation.mutate();
  }

  const charCount = text.length;
  const isOverLimit = charCount > MAX_CHARS;
  const isSubmitDisabled = mutation.isPending || text.trim().length === 0 || isOverLimit;
  const describedBy = [counterId, errorMessage ? errorId : ''].filter(Boolean).join(' ');

  return (
    <section aria-labelledby="feedback-form-heading" className="feedback-form-section">
      <h3 id="feedback-form-heading" className="feedback-form-heading">
        Leave Feedback
      </h3>

      {successMessage && (
        <p role="status" aria-live="polite" className="feedback-success">
          {successMessage}
        </p>
      )}

      {errorMessage && (
        <p
          id={errorId}
          role="alert"
          aria-live="assertive"
          className="feedback-error"
        >
          {errorMessage}
        </p>
      )}

      <form onSubmit={handleSubmit} className="feedback-form" noValidate>
        <div className="feedback-form-field">
          <label htmlFor={fieldId} className="feedback-form-label">
            Your feedback
          </label>
          <textarea
            id={fieldId}
            className={`feedback-form-textarea${isOverLimit ? ' feedback-form-textarea--error' : ''}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            disabled={mutation.isPending}
            aria-describedby={describedBy || undefined}
          />
          <span
            id={counterId}
            className={`feedback-char-counter${isOverLimit ? ' feedback-char-counter--error' : ''}`}
            aria-live="polite"
          >
            {charCount}/{MAX_CHARS}
          </span>
        </div>

        <div
          className="feedback-form-actions"
          aria-live="polite"
          aria-busy={mutation.isPending ? 'true' : 'false'}
        >
          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitDisabled}
            aria-label={mutation.isPending ? 'Saving feedback…' : 'Submit feedback'}
          >
            {mutation.isPending ? 'Saving…' : 'Submit'}
          </button>
        </div>
      </form>
    </section>
  );
}
