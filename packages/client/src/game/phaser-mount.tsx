import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { getGameConfig } from './game-config';
import type { SceneKey } from './scene-registry';

interface PhaserMountProps {
  initialScene: SceneKey;
}

export default function PhaserMount({ initialScene }: PhaserMountProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const config = getGameConfig(containerRef.current, initialScene);
    gameRef.current = new Phaser.Game(config);

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [initialScene]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
      role="application"
      aria-label="Game canvas"
    />
  );
}
