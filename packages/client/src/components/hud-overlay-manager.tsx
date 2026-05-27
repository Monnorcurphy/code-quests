import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTownStore } from '../stores/town-store';
import TownSquare from '../features/town-square';
import WarRoom from '../features/war-room';
import GuildHall from '../features/guild/guild-hall';
import ComingSoonPanel from './coming-soon-panel';
import { sceneRouter } from '../game/scene-router';
import { isTownSceneKey } from '../game/scene-registry';
import type { TownSceneKey } from '../game/scene-registry';

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

export function HUDOverlayManager() {
  const activeModal = useTownStore((s) => s.activeModal);
  const setActiveModal = useTownStore((s) => s.setActiveModal);
  const lastFocusRef = useRef<Element | null>(null);
  const prevModalRef = useRef(activeModal);

  const { sceneKey: rawSceneKey } = useParams<{ sceneKey?: string }>();
  const validSceneKey = rawSceneKey && isTownSceneKey(rawSceneKey) ? rawSceneKey : null;
  const comingSoonContent = validSceneKey ? COMING_SOON_CONTENT[validSceneKey] : undefined;

  useEffect(() => {
    if (activeModal !== null && prevModalRef.current === null) {
      lastFocusRef.current = document.activeElement;
    }
    if (activeModal === null && prevModalRef.current !== null) {
      const el = lastFocusRef.current as HTMLElement | null;
      if (el && typeof el.focus === 'function') {
        el.focus();
      }
      lastFocusRef.current = null;
    }
    prevModalRef.current = activeModal;
  }, [activeModal]);

  function handleComingSoonClose() {
    setActiveModal(null);
    sceneRouter.emitDoorEnter({ sceneKey: 'town-square', spawnX: 1600 });
  }

  if (activeModal === 'quest-board' || activeModal === 'recruit') {
    return <TownSquare />;
  }
  if (activeModal === 'draft') {
    return <WarRoom />;
  }
  if (activeModal === 'guild-hall') {
    return <GuildHall />;
  }
  if (activeModal === 'coming-soon' && comingSoonContent) {
    return (
      <ComingSoonPanel
        title={comingSoonContent.title}
        description={comingSoonContent.description}
        onClose={handleComingSoonClose}
      />
    );
  }

  return null;
}
