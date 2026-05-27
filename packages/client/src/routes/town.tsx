import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { SceneKeyboardNav } from '../components/scene-keyboard-nav';
import { HUDOverlayManager } from '../components/hud-overlay-manager';
import { SettingsButton } from '../components/settings-button';
import { sceneRouter } from '../game/scene-router';
import { isTownSceneKey } from '../game/scene-registry';
import type { SceneNavItem } from '../game/scene-router';
import type { SceneKey, TownSceneKey } from '../game/scene-registry';

const BUILDINGS: { id: TownSceneKey; name: string }[] = [
  { id: 'town-square', name: 'Town Square' },
  { id: 'war-room', name: 'War Room' },
  { id: 'oracle', name: 'Oracle' },
  { id: 'library', name: 'Library' },
  { id: 'tavern', name: 'Tavern' },
  { id: 'armory', name: 'Armory' },
  { id: 'guild-hall', name: 'Guild Hall' },
  { id: 'hall-of-returns', name: 'Hall of Returns' },
];

const PhaserMount = lazy(() => import('../game/phaser-mount'));

export function PhaserTown() {
  const { sceneKey: rawSceneKey } = useParams<{ sceneKey?: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const locationState = location.state as { spawnX?: number } | null;
  const sceneKeyParam = rawSceneKey ?? '';
  const validSceneKey: TownSceneKey | 'boot' = isTownSceneKey(sceneKeyParam)
    ? sceneKeyParam
    : 'boot';

  const mountScene = useRef<SceneKey>(validSceneKey === 'boot' ? 'boot' : validSceneKey);
  const hasMounted = useRef(false);
  const [navItems, setNavItems] = useState<SceneNavItem[]>([]);

  const currentBuilding = BUILDINGS.find((b) => b.id === validSceneKey);

  useEffect(() => {
    return sceneRouter.onInteractivesChange(setNavItems);
  }, []);

  useEffect(() => {
    const unsubscribe = sceneRouter.onDoorEnter(({ sceneKey, spawnX }) => {
      navigate(`/town/${sceneKey}`, { state: { spawnX } });
    });
    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    sceneRouter.goToScene(validSceneKey, { spawnX: locationState?.spawnX });
  }, [validSceneKey, locationState?.spawnX]);

  return (
    <main style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {currentBuilding && (
        <h1
          style={{ position: 'absolute', left: '-9999px', top: 0 }}
          aria-live="polite"
        >
          {currentBuilding.name}
        </h1>
      )}
      <SceneKeyboardNav items={navItems} />
      <HUDOverlayManager />
      <SettingsButton />
      <Suspense fallback={null}>
        <PhaserMount initialScene={mountScene.current} />
      </Suspense>
    </main>
  );
}

export default PhaserTown;
