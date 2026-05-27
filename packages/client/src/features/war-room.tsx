import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFocusTrap } from '../lib/use-focus-trap';
import { useTownStore } from '../stores/town-store';
import DraftForm from './quests/draft-form';
import SpecAuditPanel from './quests/spec-audit-panel';
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

  const { data: questData, isLoading, error } = useQuery({
    queryKey: ['quest', questId],
    queryFn: () => api.quests.get(questId),
  });
  // fetchJson infers a slightly wider type due to Zod default handling; cast to Quest
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
      <div className="form-actions">
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
