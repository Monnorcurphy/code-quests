import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { getGameConfig } from './game-config';
import { sceneRouter } from './scene-router';
import type { SceneKey } from './scene-registry';

interface PhaserMountProps {
  initialScene: SceneKey;
  questId?: string;
}

export default function PhaserMount({ initialScene, questId }: PhaserMountProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const initialSceneRef = useRef(initialScene);
  const questIdRef = useRef(questId);

  useEffect(() => {
    if (!containerRef.current) return;

    const config = getGameConfig(containerRef.current, initialSceneRef.current, questIdRef.current);
    const game = new Phaser.Game(config);
    gameRef.current = game;
    sceneRouter.init(game);

    return () => {
      game.destroy(true);
      sceneRouter.init(null);
      gameRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
      role="application"
      aria-label="Game canvas"
    />
  );
}
