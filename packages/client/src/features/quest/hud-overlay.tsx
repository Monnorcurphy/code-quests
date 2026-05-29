import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useQuestStore } from '../../stores/quest-store';
import { useEncounterStore } from '../../stores/encounter-store';
import CombatLog from './combat-log';
import ReturnToTownButton from './return-to-town-button';
import { BlockControls } from './block-controls';
import { PausedInputModal } from './paused-input-modal';
import { UserBlockedModal } from './user-blocked-modal';
import { BellCue } from './bell-cue';
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
  if (!adventurerId) return <span style={{ color: '#d1d5db', fontStyle: 'italic' }}>No adventurer</span>;
  if (!adventurer) return <span style={{ color: '#e5e7eb' }}>Loading…</span>;
  return <span style={{ color: '#f9fafb', fontWeight: 500 }}>{adventurer.name}</span>;
}

export default function HUDOverlay({
  quest,
  questId,
  advanceLoading,
  advanceError,
  connectionStatus,
  parseError,
}: HUDOverlayProps) {
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const storeStatus = useQuestStore((s) => s.statusByQuest[questId]);
  const storeScene = useQuestStore((s) => s.currentSceneByQuest[questId]);
  const encounter = useEncounterStore((s) => s.byQuest[questId] ?? null);
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
          <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#f9fafb' }}>
            {quest.title}
          </h1>
          <span style={{ fontSize: '0.875rem', color: '#d1d5db' }} aria-label="Adventurer">
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
            <span style={{ color: '#f9fafb' }}>{statusLabel}</span>
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
              color: '#f9fafb',
              background:
                connectionStatus === 'connected'
                  ? 'rgba(30,120,30,0.8)'
                  : connectionStatus === 'closed'
                    ? 'rgba(120,30,30,0.8)'
                    : 'rgba(120,90,20,0.8)',
            }}
          >
            {CONNECTION_LABELS[connectionStatus]}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BlockControls questId={questId} status={displayStatus} />
          <ReturnToTownButton />
        </div>
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
            <span style={{ fontSize: '0.8rem', color: '#f9fafb' }}>
              Advancing scene…
            </span>
          )}
          {(advanceError || parseError) && (
            <span style={{ fontSize: '0.8rem', color: '#f9fafb' }}>
              {advanceError ?? parseError}
            </span>
          )}
        </div>
      )}

      {/* Encounter panel — screen-reader accessible version of the Phaser canvas combat */}
      <div
        aria-live="polite"
        aria-label="Active encounter"
        role="region"
        style={{
          position: 'absolute',
          top: '60px',
          right: '16px',
          pointerEvents: 'none',
          minWidth: '130px',
          transition: reducedMotion ? 'none' : 'opacity 0.2s ease',
          opacity: encounter ? 1 : 0,
        }}
      >
        {encounter && (
          <div
            style={{
              background: 'rgba(20, 10, 0, 0.88)',
              border: '1px solid rgba(245, 222, 179, 0.4)',
              borderRadius: '6px',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <img
              src={encounter.spritePath}
              alt={encounter.monsterName}
              style={{ width: '48px', height: '48px', imageRendering: 'pixelated' }}
            />
            <span
              style={{ fontWeight: 600, fontSize: '0.875rem', color: '#f5f5f5' }}
            >
              {encounter.monsterName}
            </span>
            <span
              aria-label={`Difficulty ${encounter.difficulty} out of 5`}
              style={{ color: '#f5deb3', fontSize: '0.8rem', letterSpacing: '2px' }}
            >
              {'★'.repeat(encounter.difficulty)}{'☆'.repeat(5 - encounter.difficulty)}
            </span>
            <div
              role="meter"
              aria-label={`HP: ${encounter.hp}%`}
              aria-valuenow={encounter.hp}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ width: '100%' }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '3px',
                }}
              >
                <span style={{ fontSize: '0.7rem', color: '#aaa' }}>HP</span>
                <span style={{ fontSize: '0.7rem', color: '#f5f5f5' }}>{encounter.hp}%</span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '7px',
                  background: '#333',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${encounter.hp}%`,
                    height: '100%',
                    background:
                      encounter.hp > 50 ? '#44cc44' : encounter.hp > 25 ? '#ccaa44' : '#cc4444',
                    transition: reducedMotion ? 'none' : 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

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

      {/* Bell cue — attention signal for paused_input / user_blocked */}
      <BellCue questId={questId} />

      {/* Parchment modals — self-show based on store state */}
      <PausedInputModal questId={questId} />
      <UserBlockedModal questId={questId} />
    </div>
  );
}
