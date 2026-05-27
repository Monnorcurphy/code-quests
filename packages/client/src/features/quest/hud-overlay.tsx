import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Quest } from '@code-quests/shared';

const STATUS_LABELS: Record<string, string> = {
  idle: 'Idle',
  active: 'Active',
  complete: 'Complete',
  failed: 'Failed',
  paused_input: 'Awaiting Input',
  user_blocked: 'Blocked',
};

interface HUDOverlayProps {
  quest: Quest;
  onReturnToTown: () => void;
  advanceLoading: boolean;
  advanceError: string | null;
}

function AdventurerName({ adventurerId }: { adventurerId: string | null }) {
  const { data: adventurer } = useQuery({
    queryKey: ['adventurer', adventurerId],
    queryFn: () => (adventurerId ? api.adventurers.get(adventurerId) : Promise.resolve(null)),
    enabled: adventurerId !== null,
  });
  if (!adventurerId) return <span className="text-gray-300 italic">No adventurer</span>;
  if (!adventurer) return <span className="text-gray-200">Loading…</span>;
  return <span className="text-gray-100 font-medium">{adventurer.name}</span>;
}

export default function HUDOverlay({ quest, onReturnToTown, advanceLoading, advanceError }: HUDOverlayProps) {
  const statusLabel = STATUS_LABELS[quest.status] ?? quest.status;

  return (
    <div
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}
      aria-label="Quest HUD"
    >
      {/* Top banner */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          background: 'rgba(30, 20, 10, 0.85)',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 className="text-gray-100 font-bold" style={{ margin: 0, fontSize: '1rem' }}>
            {quest.title}
          </h1>
          <span
            className="text-gray-300"
            style={{ fontSize: '0.875rem' }}
            aria-label="Adventurer"
          >
            <AdventurerName adventurerId={quest.adventurerId} />
          </span>
          <span
            className={`quest-status-badge quest-status-badge--${quest.status}`}
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: 'rgba(255,255,255,0.15)',
            }}
            aria-label={`Status: ${statusLabel}`}
          >
            <span className="text-gray-100">{statusLabel}</span>
          </span>
        </div>

        <button
          onClick={onReturnToTown}
          className="text-gray-100"
          style={{
            padding: '6px 14px',
            background: 'rgba(80, 60, 30, 0.9)',
            border: '1px solid rgba(200,160,80,0.6)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
          aria-label="Return to Town"
        >
          Return to Town
        </button>
      </div>

      {/* Advance-scene feedback strip */}
      {(advanceLoading || advanceError) && (
        <div
          role={advanceError ? 'alert' : 'status'}
          aria-live={advanceError ? 'assertive' : 'polite'}
          style={{
            position: 'absolute',
            top: '52px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 16px',
            borderRadius: '4px',
            background: advanceError ? 'rgba(180,30,30,0.9)' : 'rgba(30,100,30,0.85)',
            pointerEvents: 'auto',
          }}
        >
          {advanceLoading && !advanceError && (
            <span className="text-gray-100" style={{ fontSize: '0.8rem' }}>
              Advancing scene…
            </span>
          )}
          {advanceError && (
            <span className="text-gray-100" style={{ fontSize: '0.8rem' }}>
              {advanceError}
            </span>
          )}
        </div>
      )}

      {/* Combat log placeholder */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: '140px',
          background: 'rgba(20, 12, 5, 0.75)',
          padding: '8px 16px',
          pointerEvents: 'auto',
          overflowY: 'auto',
        }}
        role="log"
        aria-label="Combat log"
        aria-live="polite"
      >
        <p className="text-gray-200" style={{ margin: 0, fontSize: '0.8rem', fontStyle: 'italic' }}>
          Combat log will appear here
        </p>
      </div>
    </div>
  );
}
