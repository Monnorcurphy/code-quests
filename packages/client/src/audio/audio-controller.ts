import type { AudioBackend } from './backend';
import type { AudioEvent } from './audio-events';
import { LOOPING_EVENTS } from './audio-events';
import type { QuestStatus } from '@code-quests/shared';
import type { ActiveEncounter } from '../stores/encounter-store';
import { isQuestSceneKey } from '../game/scene-registry';

export const BOSS_MONSTER_TYPES = new Set(['lich_repeated_failure', 'dragon_epic_obstacle']);

// Minimal store interfaces — only what AudioController requires
interface QuestStoreSlice {
  statusByQuest: Record<string, QuestStatus>;
}

interface SceneStoreSlice {
  currentScene: string;
}

interface EncounterStoreSlice {
  byQuest: Record<string, ActiveEncounter | null>;
}

type StoreRef<S> = {
  getState(): S;
  subscribe(listener: (state: S, prevState: S) => void): () => void;
};

export type QuestStore = StoreRef<QuestStoreSlice>;
export type SceneStore = StoreRef<SceneStoreSlice>;
export type EncounterStore = StoreRef<EncounterStoreSlice>;

export interface AudioControllerSnapshot {
  sceneKey: string;
  dominantStatus: QuestStatus | null;
  activeEncounter: ActiveEncounter | null;
}

/**
 * Pure state-to-loop-event reducer. Does not handle one-shot events.
 * paused_input and user_blocked are treated as 'active' so the loop keeps playing.
 */
export function deriveAudioEvent(snapshot: AudioControllerSnapshot): AudioEvent {
  // Any non-null encounter (pending or resolved) keeps the combat loop playing
  // until the encounter is explicitly cleared from the store.
  if (snapshot.activeEncounter) {
    return BOSS_MONSTER_TYPES.has(snapshot.activeEncounter.monsterTypeId) ? 'BOSS' : 'COMBAT';
  }

  // Paused/blocked quests keep the road loop playing (bell fires separately).
  const isActive =
    snapshot.dominantStatus === 'active' ||
    snapshot.dominantStatus === 'paused_input' ||
    snapshot.dominantStatus === 'user_blocked';

  if (isActive && isQuestSceneKey(snapshot.sceneKey)) {
    return 'ROAD';
  }

  return 'TOWN';
}

function buildSnapshot(
  questSlice: QuestStoreSlice,
  sceneSlice: SceneStoreSlice,
  encounterSlice: EncounterStoreSlice,
): AudioControllerSnapshot {
  let activeEncounter: ActiveEncounter | null = null;
  for (const enc of Object.values(encounterSlice.byQuest)) {
    if (enc) {
      activeEncounter = enc;
      break;
    }
  }

  const statuses = Object.values(questSlice.statusByQuest);
  const PRIORITY: QuestStatus[] = [
    'paused_input',
    'user_blocked',
    'active',
    'complete',
    'failed',
    'idle',
  ];
  let dominantStatus: QuestStatus | null = null;
  for (const s of PRIORITY) {
    if (statuses.includes(s)) {
      dominantStatus = s;
      break;
    }
  }

  return {
    sceneKey: sceneSlice.currentScene,
    dominantStatus,
    activeEncounter,
  };
}

export interface AudioController {
  start(backend: AudioBackend): void;
  stop(): void;
}

export function createAudioController(deps: {
  questStore: QuestStore;
  sceneStore: SceneStore;
  encounterStore: EncounterStore;
}): AudioController {
  let backend: AudioBackend | null = null;
  const unsubs: Array<() => void> = [];
  let currentLoopEvent: AudioEvent | null = null;
  let prevPausedOrBlocked = false;
  let prevEncounterOutcomeByQuest: Record<string, string> = {};
  let prevStatusByQuest: Record<string, QuestStatus> = {};

  function onStateChange(): void {
    if (!backend) return;

    const questSlice = deps.questStore.getState();
    const sceneSlice = deps.sceneStore.getState();
    const encounterSlice = deps.encounterStore.getState();

    // --- One-shot: PAUSE_BELL on rising edge of paused_input | user_blocked ---
    const nowPausedOrBlocked = Object.values(questSlice.statusByQuest).some(
      (s) => s === 'paused_input' || s === 'user_blocked',
    );
    if (nowPausedOrBlocked && !prevPausedOrBlocked) {
      backend.play('PAUSE_BELL', { loop: false });
    }
    prevPausedOrBlocked = nowPausedOrBlocked;

    // --- One-shot: VICTORY_STINGER when encounter outcome → 'victory' ---
    for (const [qid, enc] of Object.entries(encounterSlice.byQuest)) {
      const prev = prevEncounterOutcomeByQuest[qid] ?? 'none';
      if (enc?.outcome === 'victory' && prev !== 'victory') {
        backend.play('VICTORY_STINGER', { loop: false });
      }
      prevEncounterOutcomeByQuest[qid] = enc?.outcome ?? 'none';
    }

    // --- One-shot: QUEST_COMPLETE / QUEST_FAILED on quest status transitions ---
    for (const [qid, status] of Object.entries(questSlice.statusByQuest)) {
      const prev = prevStatusByQuest[qid];
      if (status === 'complete' && prev !== 'complete') {
        backend.play('QUEST_COMPLETE', { loop: false });
      } else if (status === 'failed' && prev !== 'failed') {
        backend.play('QUEST_FAILED', { loop: false });
      }
      prevStatusByQuest[qid] = status;
    }

    // --- Loop event: only re-play when the derived event changes ---
    const snapshot = buildSnapshot(questSlice, sceneSlice, encounterSlice);
    const loopEvent = deriveAudioEvent(snapshot);
    if (loopEvent !== currentLoopEvent) {
      backend.play(loopEvent, { loop: LOOPING_EVENTS.has(loopEvent) });
      currentLoopEvent = loopEvent;
    }
  }

  return {
    start(b: AudioBackend): void {
      // Guard against double-start: clean up previous session first.
      if (backend) {
        for (const unsub of unsubs.splice(0)) unsub();
        backend.stopAll();
      }

      backend = b;

      // Initialise prev-state tracking from current store snapshots.
      const questSlice = deps.questStore.getState();
      const encounterSlice = deps.encounterStore.getState();

      prevStatusByQuest = { ...questSlice.statusByQuest };
      prevEncounterOutcomeByQuest = {};
      for (const [qid, enc] of Object.entries(encounterSlice.byQuest)) {
        prevEncounterOutcomeByQuest[qid] = enc?.outcome ?? 'none';
      }
      prevPausedOrBlocked = Object.values(questSlice.statusByQuest).some(
        (s) => s === 'paused_input' || s === 'user_blocked',
      );

      // Play the initial loop event.
      const snapshot = buildSnapshot(questSlice, deps.sceneStore.getState(), encounterSlice);
      const loopEvent = deriveAudioEvent(snapshot);
      backend.play(loopEvent, { loop: LOOPING_EVENTS.has(loopEvent) });
      currentLoopEvent = loopEvent;

      // Subscribe to store changes.
      unsubs.push(deps.questStore.subscribe(onStateChange));
      unsubs.push(deps.sceneStore.subscribe(onStateChange));
      unsubs.push(deps.encounterStore.subscribe(onStateChange));
    },

    stop(): void {
      for (const unsub of unsubs.splice(0)) unsub();
      backend?.stopAll();
      backend = null;
      currentLoopEvent = null;
      prevPausedOrBlocked = false;
      prevEncounterOutcomeByQuest = {};
      prevStatusByQuest = {};
    },
  };
}
