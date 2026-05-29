import { useRef, useState } from 'react';
import type { FailureSummaryRecommendation } from '@code-quests/shared';
import type { HallOfReturnsQuest, RepostResult, SplitResult } from '../../../lib/api';
import RepostDialog from './repost-dialog';
import RetireDialog from './retire-dialog';
import SplitDialog from './split-dialog';

type DialogType = 'repost' | 'retire' | 'split' | null;

interface ActionBarProps {
  questId: string;
  quest: HallOfReturnsQuest;
  recommendation: FailureSummaryRecommendation | undefined;
}

function isRecommendedFor(action: 'repost' | 'retire' | 'split', rec: FailureSummaryRecommendation | undefined): boolean {
  if (!rec) return false;
  if (action === 'repost') return rec === 'repost_with_clarification' || rec === 'retry';
  if (action === 'retire') return rec === 'retire';
  if (action === 'split') return rec === 'break_into_smaller';
  return false;
}

export default function ActionBar({ questId, quest, recommendation }: ActionBarProps) {
  const [openDialog, setOpenDialog] = useState<DialogType>(null);
  const [repostResult, setRepostResult] = useState<RepostResult | null>(null);
  const [splitResult, setSplitResult] = useState<SplitResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const repostBtnRef = useRef<HTMLButtonElement>(null);
  const retireBtnRef = useRef<HTMLButtonElement>(null);
  const splitBtnRef = useRef<HTMLButtonElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  function handleRepostSuccess(result: RepostResult) {
    setRepostResult(result);
    showToast(`New quest posted: ${result.newTitle}`);
    setOpenDialog(null);
  }

  function handleRetireSuccess() {
    showToast('Quest retired');
    setOpenDialog(null);
  }

  function handleSplitSuccess(result: SplitResult) {
    setSplitResult(result);
    showToast(`Split into ${result.questIds.length} quests`);
    setOpenDialog(null);
  }

  const repostRec = isRecommendedFor('repost', recommendation);
  const retireRec = isRecommendedFor('retire', recommendation);
  const splitRec = isRecommendedFor('split', recommendation);

  return (
    <section aria-labelledby="action-bar-heading" className="action-bar">
      <h3 id="action-bar-heading" className="action-bar-heading">
        Actions
      </h3>

      <p role="status" aria-live="polite" className="action-bar-toast" aria-atomic="true">
        {toast ?? ''}
      </p>

      <div className="action-bar-buttons">
        <button
          ref={repostBtnRef}
          type="button"
          className={`action-btn action-btn--repost${repostRec ? ' action-btn--recommended' : ''}`}
          onClick={() => setOpenDialog('repost')}
          aria-current={repostRec ? 'true' : undefined}
        >
          Re-post Quest
          {repostRec && (
            <span className="action-btn-badge" aria-label="(Recommended)">
              Recommended
            </span>
          )}
        </button>

        <button
          ref={retireBtnRef}
          type="button"
          className={`action-btn action-btn--retire${retireRec ? ' action-btn--recommended' : ''}`}
          onClick={() => setOpenDialog('retire')}
          aria-current={retireRec ? 'true' : undefined}
        >
          Retire Quest
          {retireRec && (
            <span className="action-btn-badge" aria-label="(Recommended)">
              Recommended
            </span>
          )}
        </button>

        <button
          ref={splitBtnRef}
          type="button"
          className={`action-btn action-btn--split${splitRec ? ' action-btn--recommended' : ''}`}
          onClick={() => setOpenDialog('split')}
          aria-current={splitRec ? 'true' : undefined}
        >
          Break into Smaller Quests
          {splitRec && (
            <span className="action-btn-badge" aria-label="(Recommended)">
              Recommended
            </span>
          )}
        </button>
      </div>

      {repostResult && (
        <p className="action-bar-linkage">
          Re-posted as{' '}
          <a href="/town/war-room" className="action-bar-link">
            {repostResult.newTitle}
          </a>
        </p>
      )}

      {splitResult && (
        <p className="action-bar-linkage">
          {'Split into: '}
          {splitResult.titles.map((title, i) => (
            <span key={splitResult.questIds[i]}>
              <a href="/town/war-room" className="action-bar-link">
                {title}
              </a>
              {i < splitResult.titles.length - 1 ? ', ' : ''}
            </span>
          ))}
        </p>
      )}

      {openDialog === 'repost' && (
        <RepostDialog
          questId={questId}
          quest={quest}
          triggerRef={repostBtnRef}
          onClose={() => setOpenDialog(null)}
          onSuccess={handleRepostSuccess}
        />
      )}

      {openDialog === 'retire' && (
        <RetireDialog
          questId={questId}
          triggerRef={retireBtnRef}
          onClose={() => setOpenDialog(null)}
          onSuccess={handleRetireSuccess}
        />
      )}

      {openDialog === 'split' && (
        <SplitDialog
          questId={questId}
          triggerRef={splitBtnRef}
          onClose={() => setOpenDialog(null)}
          onSuccess={handleSplitSuccess}
        />
      )}
    </section>
  );
}
