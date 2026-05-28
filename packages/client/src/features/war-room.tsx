import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useFocusTrap } from '../lib/use-focus-trap';
import { useTownStore } from '../stores/town-store';
import DraftForm from './quests/draft-form';
import SpecAuditPanel from './quests/spec-audit-panel';
import DispatchButton from './quests/dispatch-button';
import ActiveQuestPanel from './quests/active-quest-panel';
import CancelButton from './quests/cancel-button';
import { useRunAudit } from './quests/use-run-audit';
import { api } from '../lib/api';
import type { Quest } from '@code-quests/shared';

type WarRoomMode = 'quest' | 'form' | 'success';

function QuestDetailSection({
  questId,
  onDraftAnother,
  onClose,
}: {
  questId: string;
  onDraftAnother: () => void;
  onClose: () => void;
}) {
  const [runError, setRunError] = useState<string | null>(null);
  const [runSuccess, setRunSuccess] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goToHallOfReturns = useTownStore((s) => s.goToHallOfReturns);
  const navigate = useNavigate();

  const { data: questData, isLoading, error } = useQuery({
    queryKey: ['quest', questId],
    queryFn: () => api.quests.get(questId),
  });
  const quest = questData as Quest | undefined;

  const { mutate: runAudit, isPending } = useRunAudit(questId);

  function handleRunAudit() {
    setRunError(null);
    setRunSuccess(false);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    runAudit(undefined, {
      onSuccess: () => {
        setRunSuccess(true);
        successTimerRef.current = setTimeout(() => setRunSuccess(false), 3000);
      },
      onError: (err) => {
        setRunError(err instanceof Error ? err.message : 'Failed to run audit');
      },
    });
  }

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  if (isLoading) {
    return (
      <p className="war-room-loading" aria-live="polite">
        Loading quest…
      </p>
    );
  }

  if (error || !quest) {
    return (
      <p className="war-room-load-error" role="alert">
        Could not load quest. Make sure the server is running.
      </p>
    );
  }

  if (quest.status === 'active' || quest.status === 'paused_input' || quest.status === 'user_blocked') {
    return (
      <div className="war-room-quest-detail">
        <ActiveQuestPanel questId={questId} />
        <CancelButton questId={questId} />
        <div className="form-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => { onClose(); navigate(`/quest/${questId}`); }}
            aria-label="Watch quest in progress"
          >
            Watch Quest
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  if (quest.status === 'complete' || quest.status === 'failed') {
    return (
      <div className="war-room-quest-detail">
        <h3 className="war-room-quest-title">{quest.title}</h3>
        <p className={`war-room-terminal-status war-room-terminal-status--${quest.status}`}>
          {quest.status === 'complete' ? '🎉 Quest complete!' : '💀 Quest failed.'}
        </p>
        {quest.failureSummary && (
          <p className="war-room-failure-reason">{quest.failureSummary.reason}</p>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={goToHallOfReturns}
          >
            Return to Hall of Returns
          </button>
          <button type="button" className="btn-secondary" onClick={onDraftAnother}>
            Draft new quest
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="war-room-quest-detail">
      <h3 className="war-room-quest-title">{quest.title}</h3>
      <SpecAuditPanel
        quest={quest}
        onRunAudit={handleRunAudit}
        isRunning={isPending}
        runError={runError}
        runSuccess={runSuccess}
      />
      <DispatchButton quest={quest} />
      <div className="form-actions">
        <button
          type="button"
          className="btn-secondary"
          disabled
          title="Dispatch first"
          aria-disabled="true"
          aria-label="Watch quest (dispatch first to enable)"
        >
          Watch Quest
        </button>
        <button type="button" className="btn-secondary" onClick={onDraftAnother}>
          Draft new quest
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export default function WarRoom() {
  const setActiveModal = useTownStore((s) => s.setActiveModal);
  const selectedQuestId = useTownStore((s) => s.selectedQuestId);
  const setSelectedQuestId = useTownStore((s) => s.setSelectedQuestId);
  const [mode, setMode] = useState<WarRoomMode>(selectedQuestId ? 'quest' : 'form');
  const panelRef = useFocusTrap(() => setActiveModal(null));

  useEffect(() => {
    if (selectedQuestId) setMode('quest');
  }, [selectedQuestId]);

  function handleClose() {
    setActiveModal(null);
  }

  function handleDraftAnother() {
    setSelectedQuestId(null);
    setMode('form');
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="war-room-title"
    >
      <div ref={panelRef} className="modal-panel war-room-panel">
        <h2 id="war-room-title" className="modal-title">
          War Room
        </h2>

        {mode === 'quest' && selectedQuestId ? (
          <QuestDetailSection
            questId={selectedQuestId}
            onDraftAnother={handleDraftAnother}
            onClose={handleClose}
          />
        ) : mode === 'success' ? (
          <div className="war-room-success-actions">
            <p className="war-room-success-hint">Quest added to the board.</p>
            <div className="form-actions">
              <button className="btn-primary" onClick={handleDraftAnother}>
                Draft Another
              </button>
              <button className="btn-secondary" onClick={handleClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="modal-body">
              Define your quest. Set the title, describe the mission, and lock in acceptance criteria.
            </p>
            <DraftForm
              onSuccess={() => setMode('success')}
              onCancel={handleClose}
            />
          </>
        )}
      </div>
    </div>
  );
}
