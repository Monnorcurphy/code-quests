import type { SceneNavItem } from '../game/scene-router';

export type { SceneNavItem } from '../game/scene-router';

interface SceneKeyboardNavProps {
  items: SceneNavItem[];
}

export function SceneKeyboardNav({ items }: SceneKeyboardNavProps) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Scene interactions"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      <ul role="list">
        {items.map((item) => (
          <li key={item.id}>
            <button type="button" onClick={item.onActivate}>
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
