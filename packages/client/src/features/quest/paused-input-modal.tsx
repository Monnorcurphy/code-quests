import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useQuestStore } from '../../stores/quest-store';

interface PausedInputModalProps {
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
        'button:not([disabled]), textarea:not([disabled])',
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

export function PausedInputModal({ questId }: PausedInputModalProps) {
  const inputRequest = useQuestStore((s) => s.inputRequestByQuest[questId] ?? null);
  const status = useQuestStore((s) => s.statusByQuest[questId]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const visible = status === 'paused_input' && inputRequest !== null;

  useEffect(() => {
    if (visible) {
      textareaRef.current?.focus();
      // Pause all CSS animations globally so background activity doesn't distract
      document.body.setAttribute('data-quest-paused', 'true');
    } else {
      document.body.removeAttribute('data-quest-paused');
    }
    return () => {
      document.body.removeAttribute('data-quest-paused');
    };
  }, [visible]);

  const handleEscape = useCallback(() => {
    cancelRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      await api.quests.respondInput(questId, reply);
      setReply('');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to send reply. Try again.';
      setError(msg);
      setLoading(false);
    }
  }

  async function handleCancelQuest() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await api.quests.cancel(questId);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to cancel quest.';
      setError(msg);
      setLoading(false);
    }
  }

  if (!visible) return null;

  const bodyText = inputRequest.adventureFraming ?? inputRequest.question;
  const adventurerName = undefined;
  const title = adventurerName ? `${adventurerName} encounters a fork in the path…` : 'The path forks…';

  return (
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
          aria-labelledby="paused-input-title"
          aria-describedby="paused-input-body"
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
            id="paused-input-title"
            style={{
              margin: '0 0 12px',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#2c1a08',
              borderBottom: '1px solid #8b6914',
              paddingBottom: '8px',
            }}
          >
            {title}
          </h2>

          <p
            id="paused-input-body"
            role="alert"
            aria-atomic="true"
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

          <form onSubmit={handleSubmit}>
            <label
              htmlFor="paused-reply"
              style={{
                display: 'block',
                marginBottom: '6px',
                fontWeight: 600,
                fontSize: '0.9rem',
                color: '#2c1a08',
              }}
            >
              Your reply, my liege:
            </label>
            <textarea
              id="paused-reply"
              ref={textareaRef}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              maxLength={4000}
              disabled={loading}
              rows={4}
              required
              aria-required="true"
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #8b6914',
                borderRadius: '4px',
                background: 'rgba(255,248,220,0.8)',
                color: '#2c1a08',
                fontSize: '0.9rem',
                resize: 'vertical',
                boxSizing: 'border-box',
                fontFamily: "Georgia, 'Times New Roman', serif",
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
              <span style={{ fontSize: '0.75rem', color: '#5a3a1a' }}>
                {reply.length}/4000
              </span>
            </div>

            {error && (
              <p
                role="alert"
                aria-live="assertive"
                style={{
                  margin: '8px 0 0',
                  fontSize: '0.85rem',
                  color: '#8b1a1a',
                  fontStyle: 'normal',
                }}
              >
                {error}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', gap: '8px' }}>
              <button
                ref={cancelRef}
                type="button"
                onClick={handleCancelQuest}
                disabled={loading}
                aria-label="Cancel this quest"
                style={{
                  padding: '8px 16px',
                  border: '1px solid #8b1a1a',
                  borderRadius: '4px',
                  background: 'transparent',
                  color: '#8b1a1a',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  opacity: loading ? 0.6 : 1,
                  fontFamily: "Georgia, 'Times New Roman', serif",
                }}
              >
                Cancel quest
              </button>
              <button
                type="submit"
                disabled={loading || !reply.trim()}
                aria-busy={loading}
                style={{
                  padding: '8px 20px',
                  border: '1px solid #5a3a1a',
                  borderRadius: '4px',
                  background: loading || !reply.trim() ? '#a08040' : '#6b4c1a',
                  color: '#f5e6c8',
                  cursor: loading || !reply.trim() ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  opacity: loading || !reply.trim() ? 0.7 : 1,
                  fontFamily: "Georgia, 'Times New Roman', serif",
                }}
              >
                {loading ? 'Sending…' : 'Send reply'}
              </button>
            </div>
          </form>
        </div>
      </FocusTrap>
    </div>
  );
}
