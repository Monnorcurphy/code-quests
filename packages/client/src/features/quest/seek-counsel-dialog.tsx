import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';

interface SeekCounselDialogProps {
  questId: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}

export function SeekCounselDialog({ questId, triggerRef, onClose }: SeekCounselDialogProps) {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    const trigger = triggerRef.current;
    return () => {
      trigger?.focus();
    };
  }, [triggerRef]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
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
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await api.quests.block(questId, description);
      onClose();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to mark blocked. Try again.';
      setError(msg);
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        pointerEvents: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="seek-counsel-title"
        style={{
          background: '#f5e6c8',
          border: '2px solid #8b6914',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '480px',
          width: '90%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <h2
          id="seek-counsel-title"
          className="text-gray-900"
          style={{ margin: '0 0 16px', fontSize: '1.125rem', fontWeight: 700 }}
        >
          Seek Counsel
        </h2>
        <form onSubmit={handleSubmit}>
          <label
            htmlFor="counsel-description"
            className="text-gray-800"
            style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem' }}
          >
            What are you waiting on?
          </label>
          <textarea
            id="counsel-description"
            ref={textareaRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            disabled={loading}
            rows={4}
            className="text-gray-900"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #8b6914',
              borderRadius: '4px',
              background: '#fffdf0',
              resize: 'vertical',
              boxSizing: 'border-box',
              fontSize: '0.9rem',
            }}
            aria-required="true"
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
            <span className="text-gray-600" style={{ fontSize: '0.75rem' }}>
              {description.length}/1000
            </span>
          </div>
          {error && (
            <p
              role="alert"
              aria-live="assertive"
              className="text-red-700"
              style={{ fontSize: '0.85rem', margin: '8px 0 0' }}
            >
              {error}
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="text-gray-700"
              style={{
                padding: '8px 16px',
                border: '1px solid #8b6914',
                borderRadius: '4px',
                background: 'transparent',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !description.trim()}
              aria-busy={loading}
              style={{
                padding: '8px 16px',
                border: '1px solid #6b4e0a',
                borderRadius: '4px',
                background: loading || !description.trim() ? '#c9a84c' : '#8b6914',
                color: '#fff',
                cursor: loading || !description.trim() ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '0.9rem',
                opacity: loading || !description.trim() ? 0.7 : 1,
              }}
            >
              {loading ? 'Marking…' : 'Mark blocked'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
