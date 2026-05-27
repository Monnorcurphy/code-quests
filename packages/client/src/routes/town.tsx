import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import GuildHall from '../features/guild/guild-hall';
import TownSquare from '../features/town-square';
import WarRoom from '../features/war-room';
import ComingSoonPanel from '../components/coming-soon-panel';
import { useFocusTrap } from '../lib/use-focus-trap';
import { SceneKeyboardNav } from '../components/scene-keyboard-nav';
import { sceneRouter } from '../game/scene-router';
import { useTownStore } from '../stores/town-store';
import type { SceneNavItem } from '../game/scene-router';
import { isTownSceneKey } from '../game/scene-registry';
import type { SceneKey, TownSceneKey } from '../game/scene-registry';

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
type PlaceholderBuildingId = Exclude<BuildingId, 'town-square' | 'war-room' | 'guild-hall'>;

const COMING_SOON_CONTENT: Partial<Record<TownSceneKey, { title: string; description: string }>> = {
  oracle: {
    title: 'Oracle',
    description: 'Refine Acceptance Criteria — arriving in Phase 3.',
  },
  library: {
    title: 'Library',
    description: 'Skills + Bestiary — arriving in Phase 10.',
  },
  tavern: {
    title: 'Tavern',
    description: 'Edge Cases — arriving in Phase 3.',
  },
  armory: {
    title: 'Armory',
    description: 'Equipment Loadout — arriving in Phase 3.',
  },
  'hall-of-returns': {
    title: 'Hall of Returns',
    description: 'Completed/Failed Quests — arriving in Phase 9.',
  },
};

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

  const content = COMING_SOON_CONTENT[building.id as PlaceholderBuildingId];

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
        <p className="modal-body">{content?.description ?? 'Coming soon.'}</p>
        <button ref={closeRef} className="modal-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function HtmlTown() {
  const [openBuilding, setOpenBuilding] = useState<PlaceholderBuildingId | null>(null);
  const triggerRefs = useRef<Map<BuildingId, HTMLButtonElement>>(new Map());
  const setActiveModal = useTownStore((s) => s.setActiveModal);
  const activeModal = useTownStore((s) => s.activeModal);

  useEffect(() => {
    return () => setActiveModal(null);
  }, [setActiveModal]);

  const activeBuilding = BUILDINGS.find((b) => b.id === openBuilding) ?? null;
  const isAnyModalOpen = activeModal !== null || activeBuilding !== null;

  const prevActiveModal = useRef(activeModal);
  useEffect(() => {
    const prev = prevActiveModal.current;
    if (prev !== null && activeModal === null) {
      const focusTarget: BuildingId | null =
        prev === 'quest-board' || prev === 'recruit'
          ? 'town-square'
          : prev === 'draft'
            ? 'war-room'
            : prev === 'guild-hall'
              ? 'guild-hall'
              : null;
      if (focusTarget) triggerRefs.current.get(focusTarget)?.focus();
    }
    prevActiveModal.current = activeModal;
  }, [activeModal]);

  function handleOpen(id: BuildingId) {
    if (id === 'town-square') {
      setActiveModal('quest-board');
      return;
    }
    if (id === 'war-room') {
      setActiveModal('draft');
      return;
    }
    if (id === 'guild-hall') {
      setActiveModal('guild-hall');
      return;
    }
    setOpenBuilding(id as PlaceholderBuildingId);
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
        aria-hidden={isAnyModalOpen ? 'true' : undefined}
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

      <TownSquare />
      {activeModal === 'draft' && <WarRoom />}
      {activeModal === 'guild-hall' && <GuildHall />}
      {activeBuilding && <BuildingModal building={activeBuilding} onClose={handleClose} />}
    </main>
  );
}

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

  const activeModal = useTownStore((s) => s.activeModal);
  const setActiveModal = useTownStore((s) => s.setActiveModal);

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

  const currentBuilding = BUILDINGS.find((b) => b.id === validSceneKey);
  const comingSoonContent = COMING_SOON_CONTENT[validSceneKey as TownSceneKey];

  function handleComingSoonClose() {
    setActiveModal(null);
    sceneRouter.emitDoorEnter({ sceneKey: 'town-square', spawnX: 1600 });
  }

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
      <TownSquare />
      {activeModal === 'draft' && <WarRoom />}
      {activeModal === 'guild-hall' && <GuildHall />}
      {activeModal === 'coming-soon' && comingSoonContent && (
        <ComingSoonPanel
          title={comingSoonContent.title}
          description={comingSoonContent.description}
          onClose={handleComingSoonClose}
        />
      )}
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
