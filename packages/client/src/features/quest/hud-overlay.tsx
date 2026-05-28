import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useQuestStore } from '../../stores/quest-store';
import CombatLog from './combat-log';
import ReturnToTownButton from './return-to-town-button';
import type { Quest } from '@code-quests/shared';
import type { ConnectionStatus } from '../../lib/quest-socket';

const STATUS_LABELS: Record<string, string> = {
  idle: 'Idle',
  active: 'Active',
  complete: 'Complete',
  failed: 'Failed',
  paused_input: 'Awaiting Input',
  user_blocked: 'Blocked',
};

const CONNECTION_LABELS: Record<ConnectionStatus, string> = {
  connecting: 'Reconnecting…',
  connected: 'Live',
  closed: 'Offline',
};

interface HUDOverlayProps {
  quest: Quest;
  questId: string;
  advanceLoading: boolean;
  advanceError: string | null;
  connectionStatus: ConnectionStatus;
  parseError?: string | null;
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

export default function HUDOverlay({
  quest,
  questId,
  advanceLoading,
  advanceError,
  connectionStatus,
  parseError,
}: HUDOverlayProps) {
  const storeStatus = useQuestStore((s) => s.statusByQuest[questId]);
  const storeScene = useQuestStore((s) => s.currentSceneByQuest[questId]);
  const displayStatus = storeStatus ?? quest.status;
  const displayScene = storeScene ?? quest.currentScene;
  const statusLabel = STATUS_LABELS[displayStatus] ?? displayStatus;

  return (
    <div
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}
      aria-label="Quest HUD"
      data-current-scene={displayScene}
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
          <span className="text-gray-300" style={{ fontSize: '0.875rem' }} aria-label="Adventurer">
            <AdventurerName adventurerId={quest.adventurerId} />
          </span>
          <span
            className={`quest-status-badge quest-status-badge--${displayStatus}`}
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

          {/* Connection status chip */}
          <span
            role="status"
            aria-live="polite"
            style={{
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '0.7rem',
              fontWeight: 600,
              background:
                connectionStatus === 'connected'
                  ? 'rgba(30,120,30,0.8)'
                  : connectionStatus === 'closed'
                    ? 'rgba(120,30,30,0.8)'
                    : 'rgba(120,90,20,0.8)',
            }}
          >
            <span className="text-gray-100">{CONNECTION_LABELS[connectionStatus]}</span>
          </span>
        </div>

        <ReturnToTownButton />
      </div>

      {/* Advance-scene / parse-error feedback strip */}
      {(advanceLoading || advanceError || parseError) && (
        <div
          role={advanceError || parseError ? 'alert' : 'status'}
          aria-live={advanceError || parseError ? 'assertive' : 'polite'}
          style={{
            position: 'absolute',
            top: '52px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 16px',
            borderRadius: '4px',
            background:
              advanceError || parseError
                ? 'rgba(180,30,30,0.9)'
                : 'rgba(30,100,30,0.85)',
            pointerEvents: 'auto',
          }}
        >
          {advanceLoading && !advanceError && !parseError && (
            <span className="text-gray-100" style={{ fontSize: '0.8rem' }}>
              Advancing scene…
            </span>
          )}
          {(advanceError || parseError) && (
            <span className="text-gray-100" style={{ fontSize: '0.8rem' }}>
              {advanceError ?? parseError}
            </span>
          )}
        </div>
      )}

      {/* Combat log */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: '140px',
          background: 'rgba(20, 12, 5, 0.75)',
          pointerEvents: 'auto',
          overflow: 'hidden',
        }}
      >
        <CombatLog questId={questId} />
      </div>
    </div>
  );
}
