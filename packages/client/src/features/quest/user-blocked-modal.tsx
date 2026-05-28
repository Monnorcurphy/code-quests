import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { useQuestStore } from '../../stores/quest-store';
import { SeekCounselDialog } from './seek-counsel-dialog';

interface UserBlockedModalProps {
  questId: string;
}

function FocusTrap({ children, onEscape }: { children: React.ReactNode; onEscape: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onEscape();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = containerRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a:not([disabled])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onEscape]);

  return <div ref={containerRef}>{children}</div>;
}

export function UserBlockedModal({ questId }: UserBlockedModalProps) {
  const userBlocker = useQuestStore((s) => s.userBlockerByQuest[questId] ?? null);
  const status = useQuestStore((s) => s.statusByQuest[questId]);
  const [unblockLoading, setUnblockLoading] = useState(false);
  const [unblockError, setUnblockError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const unblockRef = useRef<HTMLButtonElement>(null);
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();

  const visible = status === 'user_blocked';

  useEffect(() => {
    if (visible) {
      unblockRef.current?.focus();
    }
  }, [visible]);

  const handleEscape = useCallback(() => {
    unblockRef.current?.focus();
  }, []);

  const handleUnblock = useCallback(async () => {
    setUnblockLoading(true);
    setUnblockError(null);
    try {
      await api.quests.unblock(questId);
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

  if (!visible) return null;

  const bodyText = userBlocker
    ? (userBlocker.adventureFraming ?? userBlocker.rawDescription)
    : 'You have paused the quest to seek counsel.';

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(20, 10, 0, 0.65)',
          pointerEvents: 'auto',
        }}
      >
        <FocusTrap onEscape={handleEscape}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-blocked-title"
            aria-describedby="user-blocked-body"
            className="parchment-modal"
            style={{
              background: 'linear-gradient(135deg, #d9c79a 0%, #c8aa70 40%, #d9c79a 100%)',
              border: '3px solid #5a3a1a',
              borderRadius: '8px',
              padding: '28px 32px',
              maxWidth: '520px',
              width: '90vw',
              boxShadow: '0 12px 48px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,240,200,0.3)',
              fontFamily: "Georgia, 'Times New Roman', serif",
            }}
          >
            <h2
              id="user-blocked-title"
              style={{
                margin: '0 0 12px',
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#2c1a08',
                borderBottom: '1px solid #8b6914',
                paddingBottom: '8px',
              }}
            >
              Seeking counsel…
            </h2>

            <p
              id="user-blocked-body"
              role="status"
              aria-live="polite"
              style={{
                margin: '0 0 20px',
                color: '#3c2408',
                fontSize: '0.95rem',
                lineHeight: '1.6',
                fontStyle: 'italic',
              }}
            >
              {bodyText}
            </p>

            {unblockError && (
              <p
                role="alert"
                aria-live="assertive"
                style={{
                  margin: '0 0 12px',
                  fontSize: '0.85rem',
                  color: '#8b1a1a',
                  fontStyle: 'normal',
                }}
              >
                {unblockError}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                ref={editBtnRef}
                type="button"
                onClick={() => setEditOpen(true)}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #8b6914',
                  borderRadius: '4px',
                  background: 'transparent',
                  color: '#5a3a1a',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  textDecoration: 'underline',
                }}
              >
                Edit description
              </button>
              <button
                ref={unblockRef}
                type="button"
                onClick={handleUnblock}
                disabled={unblockLoading}
                aria-busy={unblockLoading}
                style={{
                  padding: '8px 20px',
                  border: '1px solid #5a3a1a',
                  borderRadius: '4px',
                  background: unblockLoading ? '#a08040' : '#6b4c1a',
                  color: '#f5e6c8',
                  cursor: unblockLoading ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  opacity: unblockLoading ? 0.7 : 1,
                  fontFamily: "Georgia, 'Times New Roman', serif",
                }}
              >
                {unblockLoading ? 'Resuming…' : 'Unblock'}
              </button>
            </div>
          </div>
        </FocusTrap>
      </div>

      {editOpen && (
        <SeekCounselDialog
          questId={questId}
          triggerRef={editBtnRef}
          onClose={() => setEditOpen(false)}
          initialDescription={userBlocker?.rawDescription ?? ''}
        />
      )}
    </>
  );
}
