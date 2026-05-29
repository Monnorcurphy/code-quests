import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTownStore } from '../../stores/town-store';

export default function ReturnToTownButton() {
  const navigate = useNavigate();
  const townScene = useTownStore((s) => s.currentScene);

  const handleClick = useCallback(() => {
    const safeScene =
      townScene === 'boot' || String(townScene).startsWith('quest-')
        ? 'town-square'
        : townScene;
    navigate(`/town/${safeScene}`);
  }, [navigate, townScene]);

  return (
    <button
      onClick={handleClick}
      style={{
        color: '#f9fafb',
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
  );
}
