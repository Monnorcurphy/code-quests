import type { Quest } from '@code-quests/shared';
import GapChip from './gap-chip';

interface SpecAuditPanelProps {
  quest: Quest;
  onRunAudit: () => void;
  isRunning: boolean;
  runError: string | null;
  runSuccess: boolean;
}

export default function SpecAuditPanel({
  quest,
  onRunAudit,
  isRunning,
  runError,
  runSuccess,
}: SpecAuditPanelProps) {
  const { specAudit } = quest;

  return (
    <section className="spec-audit-panel" aria-label="Quest audit">
      <h3 className="spec-audit-heading">Quest Audit</h3>

      <div aria-live="polite" aria-atomic="true" className="spec-audit-result">
        {specAudit === null && (
          <p className="spec-audit-empty">
            Audit not yet run — click &ldquo;Run audit&rdquo; below.
          </p>
        )}
        {specAudit !== null && specAudit.gaps.length === 0 && (
          <p className="spec-audit-pass">
            <span aria-hidden="true">✓</span> All checks pass.
          </p>
        )}
        {specAudit !== null && specAudit.gaps.length > 0 && (
          <ul className="spec-audit-gaps" role="list" aria-label="Audit gaps">
            {specAudit.gaps.map((gap, i) => (
              <li key={i} className="spec-audit-gap-item">
                <GapChip gap={gap} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="spec-audit-actions" aria-live="polite">
        {runSuccess && !isRunning && (
          <p className="spec-audit-success" role="status">
            Audit complete.
          </p>
        )}
        {runError && (
          <p className="spec-audit-error" role="alert">
            {runError}
          </p>
        )}
        <button
          type="button"
          className="btn-primary"
          onClick={onRunAudit}
          disabled={isRunning}
          aria-busy={isRunning}
        >
          {isRunning ? 'Running audit…' : 'Run audit'}
        </button>
      </div>
    </section>
  );
}
