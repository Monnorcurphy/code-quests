import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuestStore } from '../../stores/quest-store';
import type { QuestStatus } from '@code-quests/shared';

export type BellEventCallback = () => void;

const PAUSED_STATUSES: ReadonlySet<QuestStatus> = new Set(['paused_input', 'user_blocked']);

const reducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

interface BellCueProps {
  questId: string;
}

export function useBellEvent(questId: string, callback: BellEventCallback): void {
  const prevStatus = useRef<QuestStatus | undefined>(undefined);
  const status = useQuestStore((s) => s.statusByQuest[questId]);

  useEffect(() => {
    const prev = prevStatus.current;
    prevStatus.current = status;
    if (status !== undefined && prev !== status && PAUSED_STATUSES.has(status)) {
      callback();
    }
  });
}

export function BellCue({ questId }: BellCueProps) {
  const [ringing, setRinging] = useState(false);
  const [eventCount, setEventCount] = useState(0);
  const [flashKey, setFlashKey] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const status = useQuestStore((s) => s.statusByQuest[questId]);
  const visible = status !== undefined && PAUSED_STATUSES.has(status);

  const onBell = useCallback(() => {
    setEventCount((c) => c + 1);

    // Screen-edge flash: animated for motion users, static-then-removed for reduced-motion users
    const key = Date.now();
    setFlashKey(key);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    // For reduced-motion the CSS keeps opacity:1 (no fade animation), so we remove it after a delay
    flashTimerRef.current = setTimeout(() => {
      setFlashKey((prev) => (prev === key ? null : prev));
    }, reducedMotion ? 800 : 400);

    if (!reducedMotion) {
      setRinging(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setRinging(false);
        timerRef.current = null;
      }, 2000);
    }
  }, []);

  useBellEvent(questId, onBell);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <>
      {flashKey !== null && (
        <div
          key={flashKey}
          className={reducedMotion ? 'pause-bell-flash pause-bell-flash--static' : 'pause-bell-flash'}
          aria-hidden="true"
          data-testid="bell-flash"
        />
      )}
      <div
        data-testid="bell-cue"
        style={{
          position: 'absolute',
          top: '48px',
          right: '16px',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          className={ringing && !reducedMotion ? 'bell-ring' : undefined}
          aria-hidden="true"
          style={{ width: '32px', height: '32px', filter: 'drop-shadow(0 0 6px #d9c79a)' }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="#d9c79a"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            role="img"
          >
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6V11c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5S10.5 3.17 10.5 4v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
          </svg>
        </div>
        {eventCount > 0 && (
          <span
            key={eventCount}
            role="status"
            aria-live="assertive"
            aria-atomic="true"
            className="sr-only"
          >
            Bell rings — attention needed.
          </span>
        )}
      </div>
    </>
  );
}
