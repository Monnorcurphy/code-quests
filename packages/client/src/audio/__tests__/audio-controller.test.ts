import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createAudioController,
  deriveAudioEvent,
  BOSS_MONSTER_TYPES,
  type QuestStore,
  type SceneStore,
  type EncounterStore,
  type AudioControllerSnapshot,
} from '../audio-controller';
import { SilentBackend } from '../silent-backend';
import type { ActiveEncounter } from '../../stores/encounter-store';
import type { QuestStatus } from '@code-quests/shared';

// ---------- Mock store helpers ----------

interface QuestStoreSlice {
  statusByQuest: Record<string, QuestStatus>;
}

interface SceneStoreSlice {
  currentScene: string;
}

interface EncounterStoreSlice {
  byQuest: Record<string, ActiveEncounter | null>;
}

function createMockStore<S>(initialState: S) {
  let state = initialState;
  const listeners: Array<(state: S, prevState: S) => void> = [];

  return {
    getState: () => state,
    subscribe: (listener: (state: S, prevState: S) => void) => {
      listeners.push(listener);
      return () => {
        const idx = listeners.indexOf(listener);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    },
    setState: (patch: Partial<S>) => {
      const prev = state;
      state = { ...state, ...patch };
      for (const l of [...listeners]) l(state, prev);
    },
    listenerCount: () => listeners.length,
  };
}

function makeEncounter(
  outcome: ActiveEncounter['outcome'],
  monsterTypeId: string,
): ActiveEncounter {
  return {
    encounterId: 'enc-1',
    monsterId: 'mon-1',
    monsterName: 'Test Monster',
    monsterTypeId,
    spritePath: '/sprites/test.png',
    difficulty: 2,
    hp: 75,
    outcome,
  };
}

function makeStores() {
  const questStore = createMockStore<QuestStoreSlice>({ statusByQuest: {} });
  const sceneStore = createMockStore<SceneStoreSlice>({ currentScene: 'town-square' });
  const encounterStore = createMockStore<EncounterStoreSlice>({ byQuest: {} });
  return { questStore, sceneStore, encounterStore };
}

function playCalls(backend: SilentBackend): string[] {
  return backend.calls.filter((c) => c.method === 'play').map((c) => c.args[0] as string);
}

// ---------- Pure reducer tests (contract table) ----------

describe('deriveAudioEvent — contract table', () => {
  const townSnapshot = (extras: Partial<AudioControllerSnapshot> = {}): AudioControllerSnapshot => ({
    sceneKey: 'town-square',
    dominantStatus: null,
    activeEncounter: null,
    ...extras,
  });

  it('TOWN: app boot — no quest, town scene', () => {
    expect(deriveAudioEvent(townSnapshot())).toBe('TOWN');
  });

  it('TOWN: boot scene', () => {
    expect(deriveAudioEvent(townSnapshot({ sceneKey: 'boot' }))).toBe('TOWN');
  });

  it('TOWN: hall-of-returns scene', () => {
    expect(deriveAudioEvent(townSnapshot({ sceneKey: 'hall-of-returns' }))).toBe('TOWN');
  });

  it('ROAD: active quest + quest-forest scene, no encounter', () => {
    expect(
      deriveAudioEvent({ sceneKey: 'quest-forest', dominantStatus: 'active', activeEncounter: null }),
    ).toBe('ROAD');
  });

  it('ROAD: active quest + quest-cave scene, no encounter', () => {
    expect(
      deriveAudioEvent({ sceneKey: 'quest-cave', dominantStatus: 'active', activeEncounter: null }),
    ).toBe('ROAD');
  });

  it('ROAD: paused_input quest + quest scene (loop keeps playing during pause)', () => {
    expect(
      deriveAudioEvent({ sceneKey: 'quest-dungeon', dominantStatus: 'paused_input', activeEncounter: null }),
    ).toBe('ROAD');
  });

  it('ROAD: user_blocked quest + quest scene', () => {
    expect(
      deriveAudioEvent({ sceneKey: 'quest-boss-room', dominantStatus: 'user_blocked', activeEncounter: null }),
    ).toBe('ROAD');
  });

  it('TOWN: active quest but in a town scene (not dispatched to quest yet)', () => {
    expect(
      deriveAudioEvent({ sceneKey: 'war-room', dominantStatus: 'active', activeEncounter: null }),
    ).toBe('TOWN');
  });

  it('COMBAT: encounter pending, standard monster', () => {
    const enc = makeEncounter('pending', 'skeleton');
    expect(deriveAudioEvent({ sceneKey: 'quest-forest', dominantStatus: 'active', activeEncounter: enc })).toBe(
      'COMBAT',
    );
  });

  it('COMBAT: encounter pending with victory outcome still in store (loop stays until cleared)', () => {
    const enc = makeEncounter('victory', 'skeleton');
    expect(deriveAudioEvent({ sceneKey: 'quest-forest', dominantStatus: 'active', activeEncounter: enc })).toBe(
      'COMBAT',
    );
  });

  it('BOSS: lich_repeated_failure overrides COMBAT', () => {
    expect(BOSS_MONSTER_TYPES.has('lich_repeated_failure')).toBe(true);
    const enc = makeEncounter('pending', 'lich_repeated_failure');
    expect(deriveAudioEvent({ sceneKey: 'quest-boss-room', dominantStatus: 'active', activeEncounter: enc })).toBe(
      'BOSS',
    );
  });

  it('BOSS: dragon_epic_obstacle overrides COMBAT', () => {
    expect(BOSS_MONSTER_TYPES.has('dragon_epic_obstacle')).toBe(true);
    const enc = makeEncounter('pending', 'dragon_epic_obstacle');
    expect(deriveAudioEvent({ sceneKey: 'quest-boss-room', dominantStatus: 'active', activeEncounter: enc })).toBe(
      'BOSS',
    );
  });

  it('TOWN: quest complete, no encounter', () => {
    expect(
      deriveAudioEvent({ sceneKey: 'quest-forest', dominantStatus: 'complete', activeEncounter: null }),
    ).toBe('TOWN');
  });

  it('TOWN: quest failed, no encounter', () => {
    expect(
      deriveAudioEvent({ sceneKey: 'quest-forest', dominantStatus: 'failed', activeEncounter: null }),
    ).toBe('TOWN');
  });

  it('TOWN: no quests at all', () => {
    expect(deriveAudioEvent({ sceneKey: 'quest-forest', dominantStatus: null, activeEncounter: null })).toBe('TOWN');
  });
});

// ---------- Subscription tests ----------

describe('createAudioController', () => {
  let questStore: ReturnType<typeof createMockStore<QuestStoreSlice>>;
  let sceneStore: ReturnType<typeof createMockStore<SceneStoreSlice>>;
  let encounterStore: ReturnType<typeof createMockStore<EncounterStoreSlice>>;
  let backend: SilentBackend;

  beforeEach(() => {
    ({ questStore, sceneStore, encounterStore } = makeStores());
    backend = new SilentBackend();
  });

  it('plays initial TOWN loop on start', () => {
    const controller = createAudioController({ questStore, sceneStore, encounterStore });
    controller.start(backend);
    expect(playCalls(backend)).toEqual(['TOWN']);
    controller.stop();
  });

  it('full quest audio journey: TOWN → ROAD → COMBAT → VICTORY_STINGER → QUEST_COMPLETE → TOWN', () => {
    const controller = createAudioController({
      questStore: questStore as unknown as QuestStore,
      sceneStore: sceneStore as unknown as SceneStore,
      encounterStore: encounterStore as unknown as EncounterStore,
    });
    controller.start(backend);

    // Scene moves to quest zone (scene alone doesn't change loop — no active quest yet)
    sceneStore.setState({ currentScene: 'quest-forest' });

    // Quest becomes active → ROAD
    questStore.setState({ statusByQuest: { q1: 'active' } });

    // Monster encounter opens → COMBAT
    encounterStore.setState({ byQuest: { q1: makeEncounter('pending', 'orc') } });

    // Monster defeated → VICTORY_STINGER; loop stays COMBAT (encounter still in store)
    encounterStore.setState({ byQuest: { q1: makeEncounter('victory', 'orc') } });

    // Quest completes → QUEST_COMPLETE; loop stays COMBAT (encounter still in store)
    questStore.setState({ statusByQuest: { q1: 'complete' } });

    // Encounter cleared from store → loop transitions to TOWN
    encounterStore.setState({ byQuest: { q1: null } });

    expect(playCalls(backend)).toEqual([
      'TOWN',
      'ROAD',
      'COMBAT',
      'VICTORY_STINGER',
      'QUEST_COMPLETE',
      'TOWN',
    ]);

    controller.stop();
  });

  it('fires QUEST_FAILED on quest status → failed', () => {
    const controller = createAudioController({ questStore, sceneStore, encounterStore });
    controller.start(backend);

    questStore.setState({ statusByQuest: { q1: 'active' } });
    sceneStore.setState({ currentScene: 'quest-forest' });
    questStore.setState({ statusByQuest: { q1: 'failed' } });
    encounterStore.setState({ byQuest: {} }); // ensure encounter cleared

    expect(playCalls(backend)).toContain('QUEST_FAILED');
    controller.stop();
  });

  it('fires PAUSE_BELL only on the rising edge of paused_input', () => {
    const controller = createAudioController({ questStore, sceneStore, encounterStore });
    controller.start(backend);

    // Transition to paused — bell fires
    questStore.setState({ statusByQuest: { q1: 'paused_input' } });
    // Still paused — no second bell
    questStore.setState({ statusByQuest: { q1: 'paused_input' } });
    // Transition to active — no bell
    questStore.setState({ statusByQuest: { q1: 'active' } });
    // Transition back to paused — bell fires again
    questStore.setState({ statusByQuest: { q1: 'paused_input' } });

    const bellCalls = backend.calls.filter((c) => c.method === 'play' && c.args[0] === 'PAUSE_BELL');
    expect(bellCalls).toHaveLength(2);
    controller.stop();
  });

  it('fires PAUSE_BELL on rising edge of user_blocked', () => {
    const controller = createAudioController({ questStore, sceneStore, encounterStore });
    controller.start(backend);

    questStore.setState({ statusByQuest: { q1: 'user_blocked' } });

    const bellCalls = backend.calls.filter((c) => c.method === 'play' && c.args[0] === 'PAUSE_BELL');
    expect(bellCalls).toHaveLength(1);
    controller.stop();
  });

  it('BOSS overrides COMBAT for lich_repeated_failure monster type', () => {
    const controller = createAudioController({ questStore, sceneStore, encounterStore });
    controller.start(backend);

    sceneStore.setState({ currentScene: 'quest-boss-room' });
    questStore.setState({ statusByQuest: { q1: 'active' } });
    encounterStore.setState({ byQuest: { q1: makeEncounter('pending', 'lich_repeated_failure') } });

    expect(playCalls(backend)).toContain('BOSS');
    expect(playCalls(backend)).not.toContain('COMBAT');
    controller.stop();
  });

  it('BOSS overrides COMBAT for dragon_epic_obstacle monster type', () => {
    const controller = createAudioController({ questStore, sceneStore, encounterStore });
    controller.start(backend);

    sceneStore.setState({ currentScene: 'quest-boss-room' });
    questStore.setState({ statusByQuest: { q1: 'active' } });
    encounterStore.setState({ byQuest: { q1: makeEncounter('pending', 'dragon_epic_obstacle') } });

    expect(playCalls(backend)).toContain('BOSS');
    expect(playCalls(backend)).not.toContain('COMBAT');
    controller.stop();
  });

  it('PAUSE_BELL does not change the underlying loop', () => {
    const controller = createAudioController({ questStore, sceneStore, encounterStore });
    controller.start(backend);

    sceneStore.setState({ currentScene: 'quest-forest' });
    questStore.setState({ statusByQuest: { q1: 'active' } });
    // ROAD is now playing
    questStore.setState({ statusByQuest: { q1: 'paused_input' } });
    // PAUSE_BELL fires; loop should remain ROAD (not switch to TOWN)

    const calls = playCalls(backend);
    const roadIdx = calls.indexOf('ROAD');
    const bellIdx = calls.indexOf('PAUSE_BELL');
    expect(roadIdx).toBeGreaterThan(-1);
    expect(bellIdx).toBeGreaterThan(-1);
    // After ROAD starts, TOWN must not appear before PAUSE_BELL fires
    // (the loop should stay ROAD while paused, not switch to TOWN)
    expect(calls.slice(roadIdx + 1, bellIdx)).not.toContain('TOWN');
    controller.stop();
  });

  it('cleans up all subscriptions on stop', () => {
    const controller = createAudioController({ questStore, sceneStore, encounterStore });
    controller.start(backend);

    expect(questStore.listenerCount()).toBe(1);
    expect(sceneStore.listenerCount()).toBe(1);
    expect(encounterStore.listenerCount()).toBe(1);

    controller.stop();

    expect(questStore.listenerCount()).toBe(0);
    expect(sceneStore.listenerCount()).toBe(0);
    expect(encounterStore.listenerCount()).toBe(0);
  });

  it('does not accumulate subscriptions on repeated start/stop cycles', () => {
    const controller = createAudioController({ questStore, sceneStore, encounterStore });

    for (let i = 0; i < 3; i++) {
      controller.start(backend);
      controller.stop();
    }

    // After all stops, no listeners should remain
    expect(questStore.listenerCount()).toBe(0);
    expect(sceneStore.listenerCount()).toBe(0);
    expect(encounterStore.listenerCount()).toBe(0);

    // Updating stores after stop should not trigger any backend calls beyond the starts
    const countAfterStops = backend.calls.length;
    questStore.setState({ statusByQuest: { q1: 'active' } });
    expect(backend.calls.length).toBe(countAfterStops);
  });

  it('second start cleans up first session before starting a new one', () => {
    const controller = createAudioController({ questStore, sceneStore, encounterStore });
    const backend2 = new SilentBackend();

    controller.start(backend);
    controller.start(backend2); // should call stopAll on backend1 and reset

    // backend1 should have received stopAll
    expect(backend.calls.some((c) => c.method === 'stopAll')).toBe(true);
    // Only one set of listeners active
    expect(questStore.listenerCount()).toBe(1);

    controller.stop();
  });

  it('does not fire PAUSE_BELL if already paused when start is called', () => {
    questStore.setState({ statusByQuest: { q1: 'paused_input' } });
    const controller = createAudioController({ questStore, sceneStore, encounterStore });
    controller.start(backend);

    // No state change — PAUSE_BELL should NOT fire on initial start
    const bellCalls = backend.calls.filter((c) => c.method === 'play' && c.args[0] === 'PAUSE_BELL');
    expect(bellCalls).toHaveLength(0);
    controller.stop();
  });

  it('calls stopAll on backend when stop is invoked', () => {
    const controller = createAudioController({ questStore, sceneStore, encounterStore });
    controller.start(backend);
    controller.stop();

    expect(backend.calls.some((c) => c.method === 'stopAll')).toBe(true);
  });

  it('does not fire VICTORY_STINGER on initial start even if encounter is victory', () => {
    encounterStore.setState({ byQuest: { q1: makeEncounter('victory', 'goblin') } });
    const controller = createAudioController({ questStore, sceneStore, encounterStore });
    controller.start(backend);

    const stingerCalls = backend.calls.filter(
      (c) => c.method === 'play' && c.args[0] === 'VICTORY_STINGER',
    );
    expect(stingerCalls).toHaveLength(0);
    controller.stop();
  });

  it('loop event plays with loop: true', () => {
    const controller = createAudioController({ questStore, sceneStore, encounterStore });
    controller.start(backend);

    const townPlay = backend.calls.find((c) => c.method === 'play' && c.args[0] === 'TOWN');
    expect(townPlay?.args[1]).toMatchObject({ loop: true });
    controller.stop();
  });

  it('one-shot events play with loop: false', () => {
    const controller = createAudioController({ questStore, sceneStore, encounterStore });
    controller.start(backend);

    questStore.setState({ statusByQuest: { q1: 'active' } });
    questStore.setState({ statusByQuest: { q1: 'paused_input' } });

    const bellPlay = backend.calls.find((c) => c.method === 'play' && c.args[0] === 'PAUSE_BELL');
    expect(bellPlay?.args[1]).toMatchObject({ loop: false });
    controller.stop();
  });

  it('does not re-play the loop event if derived event has not changed', () => {
    const controller = createAudioController({ questStore, sceneStore, encounterStore });
    controller.start(backend);

    // Multiple town-scene changes should not replay TOWN
    sceneStore.setState({ currentScene: 'war-room' });
    sceneStore.setState({ currentScene: 'oracle' });

    const townPlays = backend.calls.filter((c) => c.method === 'play' && c.args[0] === 'TOWN');
    expect(townPlays).toHaveLength(1); // only the initial play
    controller.stop();
  });

  it('handles vi.spyOn on subscribe to verify unsubscribe is called', () => {
    const unsubSpy = vi.fn();
    const subscribeSpy = vi.spyOn(questStore, 'subscribe').mockReturnValue(unsubSpy);

    const controller = createAudioController({ questStore, sceneStore, encounterStore });
    controller.start(backend);
    controller.stop();

    expect(unsubSpy).toHaveBeenCalledOnce();
    subscribeSpy.mockRestore();
  });
});
