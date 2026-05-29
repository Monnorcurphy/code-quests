import { describe, it, expect } from 'vitest';
import { createStubAdapter } from '../stub-adapter';

function makeInput(questId: string) {
  return {
    questId,
    adventurerId: 'adv-test',
    adventurerName: 'Test Hero',
    modelId: 'claude-opus-4-7',
    description: 'Test quest',
    acceptanceCriteria: [],
    equipment: { skillIds: [], toolIds: [], mcpServerIds: [] },
  };
}

async function collectEvents(questId: string): Promise<string[]> {
  const adapter = createStubAdapter();
  const handle = await adapter.spawn!(makeInput(questId));
  const types: string[] = [];
  for await (const event of handle.events()) {
    types.push(event.type);
  }
  return types;
}

describe('createStubAdapter', () => {
  it('has name "stub"', () => {
    expect(createStubAdapter().name).toBe('stub');
  });

  it('complete() returns stub audit JSON', async () => {
    const adapter = createStubAdapter();
    const result = await adapter.complete!({ system: '', prompt: '' });
    expect(JSON.parse(result)).toEqual({ gaps: [] });
  });

  describe('quest-showcase-copy', () => {
    it('emits monster_appeared (Grognak) then completed', async () => {
      const types = await collectEvents('quest-showcase-copy');
      expect(types).toContain('monster_appeared');
      expect(types).toContain('monster_resolved');
      expect(types[types.length - 1]).toBe('completed');
    });

    it('monster has goblin_linter type', async () => {
      const adapter = createStubAdapter();
      const handle = await adapter.spawn!(makeInput('quest-showcase-copy'));
      const events = [];
      for await (const e of handle.events()) {
        events.push(e);
      }
      const appeared = events.find((e) => e.type === 'monster_appeared');
      expect(appeared).toBeDefined();
      if (appeared?.type === 'monster_appeared') {
        expect(appeared.monsterTypeId).toBe('goblin_linter');
        expect(appeared.monsterId).toBe('grognak-the-lint-goblin');
      }
    });
  });

  describe('quest-showcase-meter', () => {
    it('emits monster_appeared (imp) then completed', async () => {
      const types = await collectEvents('quest-showcase-meter');
      expect(types).toContain('monster_appeared');
      expect(types[types.length - 1]).toBe('completed');
    });

    it('monster has imp_typecheck type', async () => {
      const adapter = createStubAdapter();
      const handle = await adapter.spawn!(makeInput('quest-showcase-meter'));
      const events = [];
      for await (const e of handle.events()) {
        events.push(e);
      }
      const appeared = events.find((e) => e.type === 'monster_appeared');
      if (appeared?.type === 'monster_appeared') {
        expect(appeared.monsterTypeId).toBe('imp_typecheck');
      }
    });
  });

  describe('quest-showcase-jwt', () => {
    it('emits paused_input, then failed after respond()', async () => {
      const adapter = createStubAdapter();
      const handle = await adapter.spawn!(makeInput('quest-showcase-jwt'));
      const types: string[] = [];

      let pausedSeen = false;
      for await (const event of handle.events()) {
        types.push(event.type);
        if (event.type === 'paused_input' && !pausedSeen) {
          pausedSeen = true;
          await handle.respond('Use jose.');
        }
      }

      expect(types).toContain('paused_input');
      expect(types).toContain('resumed');
      expect(types[types.length - 1]).toBe('failed');
    });

    it('respond() with PAUSED_INPUT continues the sequence', async () => {
      const adapter = createStubAdapter();
      const handle = await adapter.spawn!(makeInput('quest-showcase-jwt'));
      const types: string[] = [];

      for await (const event of handle.events()) {
        types.push(event.type);
        if (event.type === 'paused_input') {
          await handle.respond('jose');
        }
      }

      // After respond, should resume and eventually emit monster_appeared events and failed
      expect(types).toContain('resumed');
      expect(types).toContain('monster_appeared');
    });

    it('cancel() stops the sequence', async () => {
      const adapter = createStubAdapter();
      const handle = await adapter.spawn!(makeInput('quest-showcase-jwt'));
      const types: string[] = [];

      for await (const event of handle.events()) {
        types.push(event.type);
        if (event.type === 'paused_input') {
          await handle.cancel();
        }
      }

      expect(types).toContain('paused_input');
      // After cancel, generator should stop (no resumed)
      expect(types).not.toContain('resumed');
    });

    it('awaitExit() resolves with exitCode 1 after failure', async () => {
      const adapter = createStubAdapter();
      const handle = await adapter.spawn!(makeInput('quest-showcase-jwt'));

      // Drain events while responding
      for await (const event of handle.events()) {
        if (event.type === 'paused_input') {
          await handle.respond('jose');
        }
      }

      const result = await handle.awaitExit();
      expect(result.exitCode).toBe(1);
    });
  });

  describe('quest-showcase-jwt repost (jwt-v2 variant)', () => {
    it('ends with completed event', async () => {
      const types = await collectEvents('quest-showcase-jwt-v2');
      expect(types[types.length - 1]).toBe('completed');
    });

    it('other jwt- prefixed quest IDs also complete cleanly', async () => {
      const types = await collectEvents('quest-showcase-jwt-repost');
      expect(types[types.length - 1]).toBe('completed');
    });
  });

  describe('default (unknown quest)', () => {
    it('ends with completed event', async () => {
      const types = await collectEvents('quest-unknown');
      expect(types[types.length - 1]).toBe('completed');
    });
  });

  describe('guard: only active in demo mode', () => {
    it('select-adapter returns stub when CODE_QUESTS_ENV=demo', async () => {
      const orig = process.env['CODE_QUESTS_ENV'];
      try {
        process.env['CODE_QUESTS_ENV'] = 'demo';
        const { getQuestAdapter } = await import('../select-adapter');
        const adapter = getQuestAdapter();
        expect(adapter.name).toBe('stub');
      } finally {
        if (orig === undefined) {
          delete process.env['CODE_QUESTS_ENV'];
        } else {
          process.env['CODE_QUESTS_ENV'] = orig;
        }
      }
    });

    it('select-adapter does NOT return stub when CODE_QUESTS_ENV is unset', async () => {
      const orig = process.env['CODE_QUESTS_ENV'];
      try {
        delete process.env['CODE_QUESTS_ENV'];
        const { getQuestAdapter } = await import('../select-adapter');
        const adapter = getQuestAdapter();
        expect(adapter.name).not.toBe('stub');
      } finally {
        if (orig !== undefined) {
          process.env['CODE_QUESTS_ENV'] = orig;
        }
      }
    });
  });
});
