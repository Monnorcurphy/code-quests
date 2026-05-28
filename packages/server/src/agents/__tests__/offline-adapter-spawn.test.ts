import { describe, it, expect } from 'vitest';
import { offlineAdapter, OFFLINE_PAUSE_QUESTION } from '../offline-adapter';
import type { AgentHandle } from '../adapter';
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

async function drainWithRespond(handle: AgentHandle): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of handle.events()) {
    events.push(event);
    if (event.type === 'paused_input') {
      await handle.respond('test response');
    }
  }
  return events;
}

describe('offline adapter spawn()', () => {
  it('yields a deterministic event sequence ending in completed', async () => {
    const handle = await offlineAdapter.spawn!(SPAWN_INPUT) as AgentHandle;
    const events = await drainWithRespond(handle);

    expect(events).toHaveLength(6);
    expect(events[0]).toMatchObject({ type: 'progress', message: 'Setting out from town' });
    expect(events[1]).toMatchObject({ type: 'paused_input', question: OFFLINE_PAUSE_QUESTION });
    expect(events[2]).toMatchObject({ type: 'resumed', source: 'input_response' });
    expect(events[3]).toMatchObject({
      type: 'combat',
      monsterTypeId: 'goblin_linter',
      message: 'Skirmish with a Goblin',
    });
    expect(events[4]).toMatchObject({ type: 'progress', message: 'Returning home' });
    expect(events[5]).toMatchObject({ type: 'completed' });
  });

  it('all events have ISO timestamps', async () => {
    const handle = await offlineAdapter.spawn!(SPAWN_INPUT);
    const events = await drainWithRespond(handle);
    for (const event of events) {
      expect(event.timestamp).toBeTruthy();
      expect(() => new Date(event.timestamp)).not.toThrow();
    }
  });

  it('awaitExit() resolves with exitCode 0 after events are drained', async () => {
    const handle = await offlineAdapter.spawn!(SPAWN_INPUT);
    await drainWithRespond(handle);
    const result = await handle.awaitExit();
    expect(result.exitCode).toBe(0);
  });

  it('pid is null for the offline adapter', async () => {
    const handle = await offlineAdapter.spawn!(SPAWN_INPUT);
    expect(handle.pid).toBeNull();
  });

  it('cancel() during pause resolves awaitExit with null exitCode', async () => {
    const handle = await offlineAdapter.spawn!(SPAWN_INPUT);

    const events: AgentEvent[] = [];
    const drainPromise = (async () => {
      for await (const event of handle.events()) {
        events.push(event);
        if (event.type === 'paused_input') {
          // don't respond — cancel instead
          break;
        }
      }
    })();

    await drainPromise;
    await handle.cancel();

    const result = await handle.awaitExit();
    expect(result.exitCode).toBeNull();
    expect(events.some((e) => e.type === 'paused_input')).toBe(true);
  });
});
