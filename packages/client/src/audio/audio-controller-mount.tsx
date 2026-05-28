import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAudioBackend } from './audio-provider';
import { createAudioController, type SceneStore } from './audio-controller';
import { useQuestStore } from '../stores/quest-store';
import { useEncounterStore } from '../stores/encounter-store';
import { useTownStore } from '../stores/town-store';

type SceneState = { currentScene: string };
type SceneListener = (state: SceneState, prev: SceneState) => void;

function makeSceneBridge(): SceneStore & { update(scene: string): void } {
  let state: SceneState = { currentScene: useTownStore.getState().currentScene };
  const listeners = new Set<SceneListener>();

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update: (scene) => {
      if (state.currentScene === scene) return;
      const prev = state;
      state = { currentScene: scene };
      for (const l of listeners) l(state, prev);
    },
  };
}

export default function AudioControllerMount() {
  const backend = useAudioBackend();
  const location = useLocation();

  const bridgeRef = useRef<ReturnType<typeof makeSceneBridge>>(null!);
  if (!bridgeRef.current) {
    bridgeRef.current = makeSceneBridge();
  }

  const controllerRef = useRef<ReturnType<typeof createAudioController>>(null!);
  if (!controllerRef.current) {
    controllerRef.current = createAudioController({
      // Zustand stores are structurally compatible with StoreRef — safe cast
      questStore: useQuestStore as unknown as Parameters<typeof createAudioController>[0]['questStore'],
      sceneStore: bridgeRef.current,
      encounterStore: useEncounterStore as unknown as Parameters<typeof createAudioController>[0]['encounterStore'],
    });
  }

  // Keep scene bridge in sync with route changes
  useEffect(() => {
    const isQuestRoute = location.pathname.startsWith('/quest/');
    const scene = isQuestRoute ? 'quest-forest' : useTownStore.getState().currentScene;
    bridgeRef.current.update(scene);
  }, [location.pathname]);

  // Keep scene bridge in sync with town store (only when on town routes)
  useEffect(() => {
    return useTownStore.subscribe((state) => {
      if (!location.pathname.startsWith('/quest/')) {
        bridgeRef.current.update(state.currentScene);
      }
    });
  }, [location.pathname]);

  // Start/stop controller when backend changes
  useEffect(() => {
    if (!backend) return;
    controllerRef.current.start(backend);
    return () => {
      controllerRef.current.stop();
    };
  }, [backend]);

  return null;
}
