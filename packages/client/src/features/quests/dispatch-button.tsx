import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SpecAuditSchema } from '@code-quests/shared';
import { api, ApiError } from '../../lib/api';
import { useTownStore } from '../../stores/town-store';
import { useFocusTrap } from '../../lib/use-focus-trap';
import GapChip from './gap-chip';
import type { Quest, SpecAudit } from '@code-quests/shared';

interface DispatchButtonProps {
  quest: Quest;
}

export default function DispatchButton({ quest }: DispatchButtonProps) {
  const [blockAudit, setBlockAudit] = useState<SpecAudit | null>(null);
  const [showBypassConfirm, setShowBypassConfirm] = useState(false);
  const [bypassCountdown, setBypassCountdown] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const dispatchAnywayBtnRef = useRef<HTMLButtonElement>(null);

  const queryClient = useQueryClient();
  const setActiveModal = useTownStore((s) => s.setActiveModal);
  const panelRef = useFocusTrap(handleCancelBypass);

  const { mutate, isPending } = useMutation({
    mutationFn: (bypass: boolean) => api.quests.dispatch(quest.id, bypass),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ['quests'] });
      void queryClient.invalidateQueries({ queryKey: ['quest', updated.id] });
      setBlockAudit(null);
      setShowBypassConfirm(false);
      setError(null);
      setSuccess(true);
      successTimerRef.current = setTimeout(() => {
        setSuccess(false);
        setActiveModal(null);
      }, 3000);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        const body = err.data as { audit?: unknown } | undefined;
        const parsed = SpecAuditSchema.safeParse(body?.audit);
        if (parsed.success) {
          setBlockAudit(parsed.data);
          setError(null);
          return;
        }
      }
      const msg = err instanceof Error ? err.message : 'Failed to dispatch quest';
      setError(msg);
    },
  });

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  useEffect(() => {
    if (showBypassConfirm) {
      cancelBtnRef.current?.focus();
    }
  }, [showBypassConfirm]);

  function handleDispatch() {
    setError(null);
    setBlockAudit(null);
    mutate(false);
  }

  function handleDispatchAnyway() {
    setBypassCountdown(2);
    setShowBypassConfirm(true);
    countdownRef.current = setInterval(() => {
      setBypassCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function handleConfirmBypass() {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setShowBypassConfirm(false);
    setError(null);
    mutate(true);
  }

  function handleCancelBypass() {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setShowBypassConfirm(false);
    setBypassCountdown(2);
    setTimeout(() => {
      dispatchAnywayBtnRef.current?.focus();
    }, 0);
  }

  // Keep rendering while success banner is showing, even if quest refetches as active.
  if (quest.status !== 'idle' && !success) return null;

  const blockGaps = blockAudit?.gaps.filter((g) => g.severity === 'block') ?? [];

  return (
    <div className="dispatch-section" aria-label="Dispatch controls">
      <div aria-live="polite" aria-atomic="true">
        {success && (
          <p className="dispatch-success" role="status">
            Quest dispatched! Returning to Town Square…
          </p>
        )}
      </div>

      {error && (
        <p className="dispatch-error" role="alert">
          {error}
        </p>
      )}

      {blockAudit && !showBypassConfirm && (
        <div className="dispatch-blocked">
          <p className="dispatch-blocked-heading">
            Blocking issues must be resolved before dispatching:
          </p>
          <ul className="dispatch-blocked-gaps" role="list" aria-label="Blocking gaps">
            {blockGaps.map((gap, i) => (
              <li key={i}>
                <GapChip gap={gap} />
              </li>
            ))}
          </ul>
          <button
            ref={dispatchAnywayBtnRef}
            type="button"
            className="btn-secondary dispatch-bypass-btn"
            onClick={handleDispatchAnyway}
            disabled={isPending}
          >
            Dispatch anyway
          </button>
        </div>
      )}

      {showBypassConfirm && (
        <div
          ref={panelRef}
          className="dispatch-confirm-panel"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="bypass-confirm-title"
        >
          <h4 id="bypass-confirm-title" className="dispatch-confirm-title">
            Dispatch with unresolved blocking gaps?
          </h4>
          <p className="dispatch-confirm-body">
            This quest has blocking audit issues. Dispatching without fixing them may lead to a
            failed quest. This action cannot be undone.
          </p>
          <div className="dispatch-confirm-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={handleConfirmBypass}
              disabled={bypassCountdown > 0 || isPending}
              aria-busy={isPending}
            >
              {bypassCountdown > 0
                ? `Confirm dispatch (${bypassCountdown}s)`
                : isPending
                  ? 'Dispatching…'
                  : 'Confirm dispatch'}
            </button>
            <button
              ref={cancelBtnRef}
              type="button"
              className="btn-secondary"
              onClick={handleCancelBypass}
              disabled={isPending}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!showBypassConfirm && !success && !blockAudit && (
        <button
          type="button"
          className="btn-primary dispatch-btn"
          onClick={handleDispatch}
          disabled={isPending}
          aria-busy={isPending}
        >
          {isPending ? 'Dispatching…' : 'Dispatch quest'}
        </button>
      )}
    </div>
  );
}
