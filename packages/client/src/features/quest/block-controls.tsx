import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { SeekCounselDialog } from './seek-counsel-dialog';
import type { QuestStatus } from '@code-quests/shared';

interface BlockControlsProps {
  questId: string;
  status: QuestStatus;
}

export function BlockControls({ questId, status }: BlockControlsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [unblockLoading, setUnblockLoading] = useState(false);
  const [unblockError, setUnblockError] = useState<string | null>(null);
  const seekCounselBtnRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();

  const handleUnblock = useCallback(async () => {
    setUnblockLoading(true);
    setUnblockError(null);
    try {
      await api.quests.unblock(questId);
      setUnblockLoading(false);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || err.status === 410)) {
        setUnblockError('The agent is no longer running this quest');
        void queryClient.invalidateQueries({ queryKey: ['quest', questId] });
      } else {
        setUnblockError(err instanceof ApiError ? err.message : 'Failed to unblock quest');
      }
      setUnblockLoading(false);
    }
  }, [questId, queryClient]);

  if (status !== 'active' && status !== 'paused_input' && status !== 'user_blocked') {
    return null;
  }

  return (
    <>
      {(status === 'active' || status === 'paused_input') && (
        <button
          ref={seekCounselBtnRef}
          type="button"
          onClick={() => setDialogOpen(true)}
          className="text-white"
          style={{
            padding: '4px 12px',
            border: '1px solid rgba(245,222,179,0.5)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 600,
            background: 'rgba(80,50,20,0.7)',
          }}
          aria-label="Seek counsel — mark yourself as blocked"
        >
          Seek counsel
        </button>
      )}

      {status === 'user_blocked' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
          <button
            type="button"
            onClick={handleUnblock}
            disabled={unblockLoading}
            aria-busy={unblockLoading}
            className="text-white"
            style={{
              padding: '4px 12px',
              border: '1px solid rgba(245,222,179,0.5)',
              borderRadius: '4px',
              cursor: unblockLoading ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: 'rgba(80,50,20,0.7)',
              opacity: unblockLoading ? 0.6 : 1,
            }}
          >
            {unblockLoading ? 'Resuming…' : 'Unblock'}
          </button>
          {unblockError && (
            <span
              role="alert"
              aria-live="assertive"
              className="text-red-300"
              style={{ fontSize: '0.7rem', maxWidth: '220px', textAlign: 'right' }}
            >
              {unblockError}
            </span>
          )}
        </div>
      )}

      {dialogOpen && (
        <SeekCounselDialog
          questId={questId}
          triggerRef={seekCounselBtnRef}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </>
  );
}
