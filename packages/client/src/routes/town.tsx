import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import GuildHall from '../features/guild/guild-hall';
import TownSquare from '../features/town-square';
import WarRoom from '../features/war-room';
import { useFocusTrap } from '../lib/use-focus-trap';
import { SceneKeyboardNav } from '../components/scene-keyboard-nav';
import type { SceneNavItem } from '../components/scene-keyboard-nav';
import { sceneRouter } from '../game/scene-router';
import { isTownSceneKey } from '../game/scene-registry';
import type { SceneKey } from '../game/scene-registry';

const USE_PHASER = import.meta.env.VITE_PHASER_TOWN !== 'false';
const PhaserMount = lazy(() => import('../game/phaser-mount'));

const BUILDINGS = [
  { id: 'town-square', name: 'Town Square', role: 'Entry & Recruiting' },
  { id: 'war-room', name: 'War Room', role: 'Quest Description' },
  { id: 'oracle', name: 'Oracle', role: 'Acceptance Criteria' },
  { id: 'library', name: 'Library', role: 'Context' },
  { id: 'tavern', name: 'Tavern', role: 'Edge Cases' },
  { id: 'armory', name: 'Armory', role: 'Equipment' },
  { id: 'guild-hall', name: 'Guild Hall', role: 'Adventurer' },
  { id: 'hall-of-returns', name: 'Hall of Returns', role: 'Post-Quest' },
] as const;

type BuildingId = (typeof BUILDINGS)[number]['id'];

interface BuildingModalProps {
  building: (typeof BUILDINGS)[number];
  onClose: () => void;
}

function BuildingModal({ building, onClose }: BuildingModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useFocusTrap(onClose);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div ref={panelRef} className="modal-panel">
        <h2 id="modal-title" className="modal-title">
          {building.name}
        </h2>
        <p className="modal-body">Coming in Phase 2 — Phaser scene</p>
        <button ref={closeRef} className="modal-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function HtmlTown() {
  const [openBuilding, setOpenBuilding] = useState<BuildingId | null>(null);
  const triggerRefs = useRef<Map<BuildingId, HTMLButtonElement>>(new Map());

  const activeBuilding = BUILDINGS.find((b) => b.id === openBuilding) ?? null;

  function handleOpen(id: BuildingId) {
    setOpenBuilding(id);
  }

  function handleClose() {
    const triggerId = openBuilding;
    setOpenBuilding(null);
    if (triggerId) {
      triggerRefs.current.get(triggerId)?.focus();
    }
  }

  return (
    <main className="town-page">
      <header className="town-header">
        <h1 className="town-title">The Town</h1>
        <p className="town-subtitle">
          Select a building to begin your quest preparation.
        </p>
      </header>

      <ul
        className="building-grid"
        role="list"
        aria-hidden={activeBuilding !== null ? 'true' : undefined}
      >
        {BUILDINGS.map((building) => (
          <li key={building.id}>
            <button
              ref={(el) => {
                if (el) triggerRefs.current.set(building.id, el);
              }}
              className="building-btn"
              aria-label={`Enter ${building.name} — ${building.role}`}
              onClick={() => handleOpen(building.id)}
            >
              <span className="building-name">{building.name}</span>
              <span className="building-role">{building.role}</span>
            </button>
          </li>
        ))}
      </ul>

      {openBuilding === 'guild-hall' && <GuildHall onClose={handleClose} />}
      {openBuilding === 'town-square' && <TownSquare onClose={handleClose} />}
      {openBuilding === 'war-room' && <WarRoom onClose={handleClose} />}
      {activeBuilding &&
        activeBuilding.id !== 'guild-hall' &&
        activeBuilding.id !== 'town-square' &&
        activeBuilding.id !== 'war-room' && (
          <BuildingModal building={activeBuilding} onClose={handleClose} />
        )}
    </main>
  );
}

function PhaserTown() {
  const { sceneKey: rawSceneKey } = useParams<{ sceneKey?: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const locationState = location.state as { spawnX?: number } | null;
  const validSceneKey: SceneKey = isTownSceneKey(rawSceneKey ?? '')
    ? (rawSceneKey as SceneKey)
    : 'boot';

  const mountScene = useRef<SceneKey>(validSceneKey === 'boot' ? 'boot' : validSceneKey);
  const hasMounted = useRef(false);

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

  const currentBuilding = BUILDINGS.find((b) => b.id === validSceneKey);
  const navItems: SceneNavItem[] = BUILDINGS.map((b) => ({
    id: b.id,
    label: `Go to ${b.name}`,
    onActivate: () => navigate(`/town/${b.id}`),
  }));

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
      <Suspense fallback={null}>
        <PhaserMount initialScene={mountScene.current} />
      </Suspense>
    </main>
  );
}

export default function Town() {
  if (USE_PHASER) {
    return <PhaserTown />;
  }

  return <HtmlTown />;
}
