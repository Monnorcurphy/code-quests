import { Link } from 'react-router-dom';
import type { FailureSummary } from '@code-quests/shared';
import type { FatalMonster } from '../../lib/api';

const RECOMMENDATION_LABELS: Record<string, string> = {
  repost_with_clarification: 'Repost with Clarification',
  retire: 'Retire',
  break_into_smaller: 'Break into Smaller Quests',
  level_up_first: 'Level Up First',
  retry: 'Retry',
};

interface FailureSummaryCardProps {
  failureSummary: FailureSummary;
  fatalMonster: FatalMonster | null;
}

export default function FailureSummaryCard({
  failureSummary,
  fatalMonster,
}: FailureSummaryCardProps) {
  const { notes, retries, recommendation, reason } = failureSummary;
  const recLabel = RECOMMENDATION_LABELS[recommendation] ?? recommendation;
  const summaryText = notes ?? reason;

  return (
    <section aria-labelledby="failure-summary-heading" className="failure-summary-card">
      <h3 id="failure-summary-heading" className="failure-summary-heading">
        Failure Summary
      </h3>

      <div className="failure-summary-rec">
        <span className="failure-summary-rec-label">Recommendation</span>
        <span
          className={`failure-rec-badge failure-rec-badge--${recommendation}`}
          aria-label={`Recommendation: ${recLabel}`}
        >
          {recLabel}
        </span>
      </div>

      {summaryText && (
        <p className="failure-summary-notes">{summaryText}</p>
      )}

      {retries !== undefined && retries > 0 && (
        <p className="failure-summary-retries">
          <span className="failure-summary-retries-label">Retries consumed:</span>{' '}
          <strong>{retries}</strong>
        </p>
      )}

      {fatalMonster && (
        <div className="failure-summary-fatal-monster">
          <span className="failure-summary-fatal-label">Fatal encounter:</span>
          <img
            src={fatalMonster.spritePath}
            alt=""
            aria-hidden="true"
            className="failure-summary-monster-sprite"
            width={24}
            height={24}
          />
          <Link
            to={`/town/library?typeId=${encodeURIComponent(fatalMonster.monsterTypeId)}`}
            className="failure-summary-monster-link"
            aria-label={`Browse Library for ${fatalMonster.monsterName} monsters`}
          >
            {fatalMonster.monsterName}
          </Link>
        </div>
      )}
    </section>
  );
}
