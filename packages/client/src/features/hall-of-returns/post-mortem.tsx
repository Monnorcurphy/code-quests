import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReducedMotion } from '../../lib/use-reduced-motion';
import { useTownStore } from '../../stores/town-store';
import { ApiError } from '../../lib/api';
import { usePostMortem } from './use-post-mortem';
import CombatLogReplay from './combat-log-replay';
import FailureSummaryCard from './failure-summary-card';
import FeedbackForm from './feedback-form';

function LoadingState() {
  return (
    <main className="post-mortem-page" aria-live="polite" aria-busy="true">
      <p className="post-mortem-loading">Loading post-mortem…</p>
    </main>
  );
}

interface ErrorStateProps {
  is404: boolean;
  onRetry: () => void;
  onBack: () => void;
}

function ErrorState({ is404, onRetry, onBack }: ErrorStateProps) {
  return (
    <main className="post-mortem-page">
      <button type="button" className="btn-secondary post-mortem-back" onClick={onBack}>
        ← Back to Hall of Returns
      </button>
      <div role="alert" className="post-mortem-error">
        <p className="post-mortem-error-msg">
          {is404
            ? 'Quest not found — it may have been deleted.'
            : 'Could not load post-mortem. Check that the server is running.'}
        </p>
        {!is404 && (
          <button type="button" className="btn-secondary" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    </main>
  );
}

export default function PostMortem() {
  const { questId } = useParams<{ questId: string }>();
  const navigate = useNavigate();
  const setActiveModal = useTownStore((s) => s.setActiveModal);
  const reducedMotion = useReducedMotion();
  const backRef = useRef<HTMLButtonElement>(null);

  const { data, isLoading, isError, error, refetch } = usePostMortem(questId ?? '');

  useEffect(() => {
    backRef.current?.focus();
  }, []);

  function handleBack() {
    setActiveModal('hall-of-returns');
    navigate('/town/hall-of-returns');
  }

  if (isLoading) return <LoadingState />;

  if (isError || !data) {
    const is404 = error instanceof ApiError && error.status === 404;
    return (
      <ErrorState
        is404={is404}
        onRetry={() => void refetch()}
        onBack={handleBack}
      />
    );
  }

  const { quest, encounters, failureSummary, adventurer } = data;

  return (
    <main
      className={`post-mortem-page${reducedMotion ? ' post-mortem-page--no-animation' : ''}`}
      aria-labelledby="post-mortem-title"
    >
      <div className="post-mortem-header">
        <button
          ref={backRef}
          type="button"
          className="btn-secondary post-mortem-back"
          onClick={handleBack}
          aria-label="Back to Hall of Returns"
        >
          ← Back
        </button>
        <h1 id="post-mortem-title" className="post-mortem-title">
          {quest.title}
        </h1>
        <span
          className={`quest-badge quest-badge--${quest.status}`}
          aria-label={`Status: ${quest.status.replace(/_/g, ' ')}`}
        >
          {quest.status.replace(/_/g, ' ')}
        </span>
      </div>

      {adventurer && (
        <p className="post-mortem-adventurer">
          <span className="post-mortem-adventurer-name">{adventurer.name}</span>
          {' · '}
          <span className="post-mortem-adventurer-class">{adventurer.class}</span>
        </p>
      )}

      <div className="post-mortem-body">
        {failureSummary && (
          <FailureSummaryCard
            failureSummary={failureSummary}
            fatalMonster={quest.fatalMonster ?? null}
          />
        )}

        <CombatLogReplay encounters={encounters} />

        <FeedbackForm questId={quest.id} />
      </div>
    </main>
  );
}
