import { useNavigate } from 'react-router-dom';
import type { TownSceneKey } from '../game/scene-registry';

// Always-visible quick-jump bar so all 7 buildings are one click away from
// any town scene. Complements the keyboard nav (walk + Enter) and the
// in-scene doors (now clickable too).

const BUILDINGS: { id: TownSceneKey; name: string; icon: string }[] = [
  { id: 'town-square', name: 'Town Square', icon: '⌂' },
  { id: 'war-room', name: 'War Room', icon: '⚔' },
  { id: 'oracle', name: 'Oracle', icon: '✦' },
  { id: 'library', name: 'Library', icon: '📜' },
  { id: 'tavern', name: 'Tavern', icon: '🍺' },
  { id: 'armory', name: 'Armory', icon: '🛡' },
  { id: 'guild-hall', name: 'Guild Hall', icon: '🏛' },
  { id: 'hall-of-returns', name: 'Hall of Returns', icon: '⚰' },
];

interface BuildingsBarProps {
  current: TownSceneKey | 'boot';
}

export function BuildingsBar({ current }: BuildingsBarProps) {
  const navigate = useNavigate();

  return (
    <nav
      aria-label="Town buildings"
      style={{
        position: 'absolute',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 4,
        padding: '4px 8px',
        background: 'rgba(20, 12, 5, 0.85)',
        border: '1px solid rgba(200, 160, 80, 0.6)',
        borderRadius: 6,
        zIndex: 50,
      }}
    >
      {BUILDINGS.map((b) => {
        const isCurrent = b.id === current;
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => navigate(`/town/${b.id}`)}
            aria-label={b.name}
            aria-current={isCurrent ? 'page' : undefined}
            title={b.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              background: isCurrent ? 'rgba(200, 160, 80, 0.25)' : 'transparent',
              border: isCurrent
                ? '1px solid rgba(220, 190, 120, 0.9)'
                : '1px solid transparent',
              borderRadius: 4,
              color: 'rgb(230, 210, 160)',
              fontSize: '0.8rem',
              fontWeight: isCurrent ? 700 : 500,
              cursor: isCurrent ? 'default' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <span aria-hidden="true" style={{ fontSize: '0.95rem' }}>
              {b.icon}
            </span>
            <span>{b.name}</span>
          </button>
        );
      })}
    </nav>
  );
}
