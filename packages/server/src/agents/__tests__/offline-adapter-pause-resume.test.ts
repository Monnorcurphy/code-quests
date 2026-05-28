import { describe, it, expect } from 'vitest';
import { offlineAdapter, OFFLINE_PAUSE_QUESTION } from '../offline-adapter';
import type { AgentEvent } from '@code-quests/shared';

const SPAWN_INPUT = {
  questId: 'quest-pause',
  adventurerId: 'adv-pause',
  adventurerName: 'Brielle',
  modelId: 'offline',
  description: 'Test pause/resume flow.',
  acceptanceCriteria: ['Paused and resumed'],
  equipment: { skillIds: [], toolIds: [], mcpServerIds: [] },
};

describe('offline adapter pause/resume', () => {
  it('emits paused_input after first progress event', async () => {
    const handle = await offlineAdapter.spawn!(SPAWN_INPUT);

    const events: AgentEvent[] = [];
    for await (const event of handle.events()) {
      events.push(event);
      if (event.type === 'paused_input') break;
    }

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ type: 'progress', message: 'Setting out from town' });
    expect(events[1]).toMatchObject({
      type: 'paused_input',
      question: OFFLINE_PAUSE_QUESTION,
    });

    await handle.cancel();
  });

  it('respond() unblocks the stream and emits resumed then remaining events', async () => {
    const handle = await offlineAdapter.spawn!(SPAWN_INPUT);

    const events: AgentEvent[] = [];
    for await (const event of handle.events()) {
      events.push(event);
      if (event.type === 'paused_input') {
        await handle.respond('use approach A');
      }
    }

    const types = events.map((e) => e.type);
    expect(types).toContain('paused_input');
    expect(types).toContain('resumed');

    const pausedIdx = types.indexOf('paused_input');
    const resumedIdx = types.indexOf('resumed');
    expect(resumedIdx).toBe(pausedIdx + 1);

    const resumedEvent = events[resumedIdx];
    if (resumedEvent.type === 'resumed') {
      expect(resumedEvent.source).toBe('input_response');
    }

    expect(types[types.length - 1]).toBe('completed');
  });

  it('cancel() during pause ends the stream without resumed event', async () => {
    const handle = await offlineAdapter.spawn!(SPAWN_INPUT);

    const events: AgentEvent[] = [];
    const drainPromise = (async () => {
      for await (const event of handle.events()) {
        events.push(event);
        if (event.type === 'paused_input') break;
      }
    })();

    await drainPromise;
    await handle.cancel();

    const result = await handle.awaitExit();
    expect(result.exitCode).toBeNull();
    expect(events.some((e) => e.type === 'resumed')).toBe(false);
    expect(events.some((e) => e.type === 'paused_input')).toBe(true);
  });

  it('events after resumed include combat and completed', async () => {
    const handle = await offlineAdapter.spawn!(SPAWN_INPUT);

    const events: AgentEvent[] = [];
    for await (const event of handle.events()) {
      events.push(event);
      if (event.type === 'paused_input') {
        await handle.respond('yes');
      }
    }

    const postResumed = events.slice(events.findIndex((e) => e.type === 'resumed') + 1);
    const postTypes = postResumed.map((e) => e.type);
    expect(postTypes).toContain('combat');
    expect(postTypes).toContain('progress');
    expect(postTypes).toContain('completed');
  });
});
