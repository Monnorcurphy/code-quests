import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useActiveQuests } from './use-active-quests';
import { sceneDisplayName } from './scene-display-name';
import type { ActiveQuestEntry } from './use-active-quests';
import type { QuestStatus } from '@code-quests/shared';

const STATUS_LABELS: Record<QuestStatus, string> = {
  idle: 'Idle',
  active: 'Active',
  complete: 'Complete',
  failed: 'Failed',
  paused_input: 'Awaiting Input',
  user_blocked: 'Blocked',
  returned_to_town: 'Returned',
  retired: 'Retired',
};

const MAX_ROWS = 8;

const BANNER_STYLE: React.CSSProperties = {
  padding: '4px 12px',
  background: 'rgba(30, 20, 10, 0.9)',
  border: '1px solid rgba(200, 160, 80, 0.7)',
  borderRadius: '4px',
  color: 'rgb(220, 190, 120)',
  cursor: 'pointer',
  fontSize: '0.8rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const LIST_STYLE: React.CSSProperties = {
  marginTop: '4px',
  background: 'rgba(25, 15, 5, 0.95)',
  border: '1px solid rgba(200, 160, 80, 0.5)',
  borderRadius: '4px',
  minWidth: '220px',
  maxHeight: '320px',
  overflowY: 'auto',
};

function AdventurerName({ adventurerId }: { adventurerId: string | null }) {
  const { data } = useQuery({
    queryKey: ['adventurer', adventurerId],
    queryFn: () =>
      adventurerId ? api.adventurers.get(adventurerId) : Promise.resolve(null),
    enabled: adventurerId !== null,
  });
  if (!adventurerId) return <span style={{ color: 'rgb(160, 140, 100)' }}>Unknown</span>;
  if (!data) return <span style={{ color: 'rgb(160, 140, 100)' }}>…</span>;
  return <span>{data.name}</span>;
}

function QuestRow({
  entry,
  onNavigate,
}: {
  entry: ActiveQuestEntry;
  onNavigate: (questId: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onNavigate(entry.quest.id)}
        aria-label={`Go to quest: ${entry.quest.title} — ${sceneDisplayName(entry.currentScene)}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          width: '100%',
          padding: '8px 12px',
          background: 'none',
          border: 'none',
          borderBottom: '1px solid rgba(200, 160, 80, 0.2)',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'rgb(210, 185, 130)',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'rgb(230, 210, 160)' }}>
          <AdventurerName adventurerId={entry.quest.adventurerId} />
        </span>
        <span style={{ fontSize: '0.75rem', color: 'rgb(190, 165, 110)' }}>
          {sceneDisplayName(entry.currentScene)}
        </span>
        <span style={{ fontSize: '0.7rem', color: 'rgb(170, 145, 90)' }}>
          {STATUS_LABELS[entry.status]}
        </span>
      </button>
    </li>
  );
}

export default function PartyMap() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const { entries, isLoading, error } = useActiveQuests();

  const count = entries.length;

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && expanded) {
        setExpanded(false);
      }
    },
    [expanded],
  );

  const handleNavigate = useCallback(
    (questId: string) => {
      navigate(`/quest/${questId}`);
    },
    [navigate],
  );

  const bannerLabel = error
    ? '⚔ Offline'
    : isLoading
      ? '⚔ …'
      : count === 0
        ? '⚔ No quests'
        : `⚔ ${count} active`;

  return (
    <div
      data-testid="party-map"
      role="complementary"
      aria-label="Party Map"
      style={{ position: 'fixed', top: '8px', right: '8px', zIndex: 20, pointerEvents: 'none' }}
      aria-busy={isLoading || undefined}
      onKeyDown={handleKeyDown}
    >
      <div style={{ pointerEvents: 'auto' }}>
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={expanded}
          aria-controls="party-map-list"
          aria-label={
            expanded
              ? `Party Map — ${bannerLabel}. Press Enter to collapse`
              : `Party Map — ${bannerLabel}. Press Enter to expand`
          }
          style={BANNER_STYLE}
        >
          <span aria-live="polite" aria-atomic="true">{bannerLabel}</span>
        </button>

        {expanded && (
          <div
            id="party-map-list"
            role="region"
            aria-label="Active quests"
            style={LIST_STYLE}
          >
            {count === 0 ? (
              <div style={{ padding: '12px' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgb(190, 165, 110)' }}>
                  No active quests.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/town/town-square')}
                  style={{
                    marginTop: '8px',
                    padding: '4px 8px',
                    background: 'rgba(30, 20, 10, 0.8)',
                    border: '1px solid rgba(200, 160, 80, 0.5)',
                    borderRadius: '4px',
                    color: 'rgb(220, 190, 120)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                  }}
                >
                  Go to Town Square
                </button>
              </div>
            ) : (
              <ul aria-label="Active quest list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {entries.slice(0, MAX_ROWS).map((entry) => (
                  <QuestRow key={entry.quest.id} entry={entry} onNavigate={handleNavigate} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
