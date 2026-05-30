import { describe, it, expect, beforeEach } from 'vitest';
import { useGuildHallStore, type GuildHallAdventurer } from '../guild-hall-store';

function makeAdventurer(overrides: Partial<GuildHallAdventurer> = {}): GuildHallAdventurer {
  return {
    id: 'adv-1',
    name: 'Aria',
    class: 'champion',
    status: 'idle',
    currentQuestTitle: null,
    style: {},
    ...overrides,
  };
}

beforeEach(() => {
  useGuildHallStore.setState({ roster: [], version: 0 });
});

describe('useGuildHallStore', () => {
  it('starts with an empty roster and version 0', () => {
    const state = useGuildHallStore.getState();
    expect(state.roster).toEqual([]);
    expect(state.version).toBe(0);
  });

  it('setRoster replaces the roster and bumps version', () => {
    useGuildHallStore.getState().setRoster([makeAdventurer()]);
    const state = useGuildHallStore.getState();
    expect(state.roster).toHaveLength(1);
    expect(state.roster[0]?.name).toBe('Aria');
    expect(state.version).toBe(1);
  });

  it('setRoster called multiple times bumps version each time', () => {
    const store = useGuildHallStore.getState();
    store.setRoster([makeAdventurer({ id: 'a' })]);
    store.setRoster([makeAdventurer({ id: 'b' })]);
    store.setRoster([makeAdventurer({ id: 'c' })]);
    expect(useGuildHallStore.getState().version).toBe(3);
    expect(useGuildHallStore.getState().roster[0]?.id).toBe('c');
  });

  it('stores dispatched adventurers with quest title', () => {
    useGuildHallStore.getState().setRoster([
      makeAdventurer({ id: 'a', status: 'on-quest', currentQuestTitle: 'Slay the Goblin' }),
      makeAdventurer({ id: 'b', status: 'idle', currentQuestTitle: null }),
    ]);
    const roster = useGuildHallStore.getState().roster;
    expect(roster[0]?.status).toBe('on-quest');
    expect(roster[0]?.currentQuestTitle).toBe('Slay the Goblin');
    expect(roster[1]?.status).toBe('idle');
    expect(roster[1]?.currentQuestTitle).toBeNull();
  });

  it('clear() empties the roster and bumps version', () => {
    useGuildHallStore.getState().setRoster([makeAdventurer()]);
    useGuildHallStore.getState().clear();
    const state = useGuildHallStore.getState();
    expect(state.roster).toEqual([]);
    expect(state.version).toBe(2);
  });

  it('subscribers receive updates when roster changes', () => {
    let observed: GuildHallAdventurer[] | null = null;
    const unsubscribe = useGuildHallStore.subscribe((state) => {
      observed = state.roster;
    });
    useGuildHallStore.getState().setRoster([makeAdventurer({ id: 'x' })]);
    expect(observed).not.toBeNull();
    expect((observed as unknown as GuildHallAdventurer[])[0]?.id).toBe('x');
    unsubscribe();
  });
});
