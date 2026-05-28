import { useEffect, useRef, useState } from 'react';
import { subscribeCue } from '../audio-cue-bus';

interface Toast {
  message: string;
  persistent: boolean;
  id: number;
}

const STINGER_TEXT: Partial<Record<string, string>> = {
  VICTORY_STINGER: 'Monster defeated!',
  QUEST_COMPLETE: 'Quest complete!',
  QUEST_FAILED: 'Quest failed — returned to town',
};

const STINGER_EVENTS = new Set(['VICTORY_STINGER', 'QUEST_COMPLETE', 'QUEST_FAILED']);

export default function StingerToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  useEffect(() => {
    return subscribeCue((event) => {
      if (!STINGER_EVENTS.has(event)) return;
      if (timerRef.current) clearTimeout(timerRef.current);

      const id = ++idRef.current;
      const persistent = event === 'QUEST_FAILED';
      setToast({ message: STINGER_TEXT[event] ?? event, persistent, id });

      if (!persistent) {
        timerRef.current = setTimeout(() => {
          setToast((curr) => (curr?.id === id ? null : curr));
        }, 3000);
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!toast) return null;

  return (
    <div
      className={`stinger-toast${toast.persistent ? ' stinger-toast--error' : ' stinger-toast--success'}`}
      aria-live={toast.persistent ? 'assertive' : 'polite'}
      aria-atomic="true"
      data-testid="stinger-toast"
    >
      <span className="stinger-toast-message">{toast.message}</span>
      {toast.persistent && (
        <button
          className="stinger-toast-dismiss"
          onClick={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            setToast(null);
          }}
          aria-label="Dismiss notification"
        >
          ×
        </button>
      )}
    </div>
  );
}
