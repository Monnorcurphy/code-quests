import { describe, it, expect } from 'vitest';
import { offlineAdapter } from '../offline-adapter';
import type { AgentEvent } from '@code-quests/shared';

const SPAWN_INPUT = {
  questId: 'quest-1',
  adventurerId: 'adv-1',
  adventurerName: 'Aria',
  modelId: 'offline',
  description: 'Defeat the goblin and return victorious.',
  acceptanceCriteria: ['Goblin defeated'],
  equipment: { skillIds: [], toolIds: [], mcpServerIds: [] },
};

describe('offline adapter spawn()', () => {
  it('yields a deterministic event sequence ending in completed', async () => {
    const handle = await offlineAdapter.spawn!(SPAWN_INPUT);

    const events: AgentEvent[] = [];
    for await (const event of handle.events()) {
      events.push(event);
    }

    expect(events).toHaveLength(4);
    expect(events[0]).toMatchObject({ type: 'progress', message: 'Setting out from town' });
    expect(events[1]).toMatchObject({
      type: 'combat',
      monsterTypeId: 'goblin_linter',
      message: 'Skirmish with a Goblin',
    });
    expect(events[2]).toMatchObject({ type: 'progress', message: 'Returning home' });
    expect(events[3]).toMatchObject({ type: 'completed' });
  });

  it('all events have ISO timestamps', async () => {
    const handle = await offlineAdapter.spawn!(SPAWN_INPUT);

    for await (const event of handle.events()) {
      expect(event.timestamp).toBeTruthy();
      expect(() => new Date(event.timestamp)).not.toThrow();
    }
  });

  it('awaitExit() resolves with exitCode 0 after events are drained', async () => {
    const handle = await offlineAdapter.spawn!(SPAWN_INPUT);

    for await (const _ of handle.events()) {
      // drain
    }

    const result = await handle.awaitExit();
    expect(result.exitCode).toBe(0);
  });

  it('pid is null for the offline adapter', async () => {
    const handle = await offlineAdapter.spawn!(SPAWN_INPUT);
    expect(handle.pid).toBeNull();
  });
});
