import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTownStore } from '../stores/town-store';
import TownSquare from '../features/town-square';
import WarRoom from '../features/war-room';
import Oracle from '../features/oracle';
import Tavern from '../features/tavern';
import Library from '../features/library';
import GuildHall from '../features/guild/guild-hall';
import LoadoutPanel from '../features/armory/loadout-panel';
import HallOfReturns from '../features/hall-of-returns/hall-of-returns';
import { HelpPanelContainer } from '../features/help-panel';
import { NpcHintPanelContainer } from '../features/npc-hint-panel';
import ModelsModal from '../features/models/models-modal';
import ComingSoonPanel from './coming-soon-panel';
import { sceneRouter } from '../game/scene-router';
import { isTownSceneKey } from '../game/scene-registry';
import type { TownSceneKey } from '../game/scene-registry';

const COMING_SOON_CONTENT: Partial<Record<TownSceneKey, { title: string; description: string }>> = {};

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
    sceneRouter.emitDoorEnter({ sceneKey: 'town-square', spawnX: 1000 });
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
  if (activeModal === 'armory-loadout') {
    return <LoadoutPanel onClose={() => setActiveModal(null)} />;
  }
  if (activeModal === 'oracle') {
    return <Oracle />;
  }
  if (activeModal === 'tavern') {
    return <Tavern />;
  }
  if (activeModal === 'library') {
    return <Library />;
  }
  if (activeModal === 'hall-of-returns') {
    return <HallOfReturns />;
  }
  if (activeModal === 'help') {
    return <HelpPanelContainer />;
  }
  if (activeModal === 'npc-hint') {
    return <NpcHintPanelContainer />;
  }
  if (activeModal === 'models') {
    return <ModelsModal onClose={() => setActiveModal(null)} />;
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
