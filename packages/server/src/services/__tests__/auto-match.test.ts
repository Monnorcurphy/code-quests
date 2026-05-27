import { describe, it, expect } from 'vitest';
import { autoMatch } from '../auto-match';
import type { Adventurer, Agent, Quest } from '@code-quests/shared';

function makeAdventurer(overrides: Partial<Adventurer> & { id: string }): Adventurer {
  return {
    id: overrides.id,
    name: overrides.name ?? `Adventurer ${overrides.id}`,
    class: overrides.class ?? 'ranger',
    modelId: overrides.modelId ?? 'haiku',
    createdAt: overrides.createdAt ?? '2024-01-01T00:00:00.000Z',
    stats: overrides.stats ?? {},
    specializations: overrides.specializations ?? [],
    scars: overrides.scars ?? [],
  };
}

function makeAgent(adventurerId: string, endedAt: string | null = null): Agent {
  return {
    id: `agent-${adventurerId}`,
    adventurerId,
    questId: 'q-1',
    startedAt: '2024-01-01T00:00:00.000Z',
    endedAt,
    pid: null,
    exitCode: null,
  };
}

function makeQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 'q-1',
    epicId: null,
    title: 'Test Quest',
    description: overrides.description ?? 'A simple quest',
    acceptanceCriteria: overrides.acceptanceCriteria ?? [],
    edgeCases: overrides.edgeCases ?? [],
    context: overrides.context ?? '',
    status: 'idle',
    adventurerId: null,
    agentId: null,
    equipment: overrides.equipment ?? { skillIds: [], toolIds: [], mcpServerIds: [] },
    specAudit: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('autoMatch', () => {
  describe('null-return cases', () => {
    it('returns null when guild is empty', () => {
      const quest = makeQuest();
      expect(autoMatch(quest, [], [])).toBeNull();
    });

    it('returns null when all adventurers are busy', () => {
      const a = makeAdventurer({ id: 'a1' });
      const quest = makeQuest();
      const agent = makeAgent('a1', null);
      expect(autoMatch(quest, [a], [agent])).toBeNull();
    });

    it('returns null when all adventurers are busy (multiple)', () => {
      const guild = [
        makeAdventurer({ id: 'a1' }),
        makeAdventurer({ id: 'a2' }),
      ];
      const agents = [makeAgent('a1', null), makeAgent('a2', null)];
      expect(autoMatch(makeQuest(), guild, agents)).toBeNull();
    });
  });

  describe('busy exclusion', () => {
    it('excludes adventurers with null ended_at', () => {
      const busy = makeAdventurer({ id: 'busy', class: 'champion' });
      const free = makeAdventurer({ id: 'free', class: 'ranger' });
      const agents = [makeAgent('busy', null)];
      const result = autoMatch(makeQuest(), [busy, free], agents);
      expect(result?.id).toBe('free');
    });

    it('does not exclude adventurers with non-null ended_at', () => {
      const prev = makeAdventurer({ id: 'prev', class: 'ranger' });
      const agents = [makeAgent('prev', '2024-01-01T12:00:00.000Z')];
      const result = autoMatch(makeQuest(), [prev], agents);
      expect(result?.id).toBe('prev');
    });
  });

  describe('class fit — champion', () => {
    it('prefers champion when equipment total >= 6', () => {
      const champion = makeAdventurer({ id: 'champ', class: 'champion' });
      const ranger = makeAdventurer({ id: 'rang', class: 'ranger' });
      const quest = makeQuest({
        equipment: { skillIds: ['s1', 's2', 's3'], toolIds: ['t1', 't2', 't3'], mcpServerIds: [] },
      });
      expect(autoMatch(quest, [ranger, champion], [])).toHaveProperty('id', 'champ');
    });

    it('prefers champion when acceptanceCriteria.length >= 5', () => {
      const champion = makeAdventurer({ id: 'champ', class: 'champion' });
      const scout = makeAdventurer({ id: 'scout', class: 'scout' });
      const quest = makeQuest({ acceptanceCriteria: ['a', 'b', 'c', 'd', 'e'] });
      expect(autoMatch(quest, [scout, champion], [])).toHaveProperty('id', 'champ');
    });

    it('prefers champion when description.length >= 600', () => {
      const champion = makeAdventurer({ id: 'champ', class: 'champion' });
      const ranger = makeAdventurer({ id: 'rang', class: 'ranger' });
      const quest = makeQuest({ description: 'x'.repeat(600) });
      expect(autoMatch(quest, [ranger, champion], [])).toHaveProperty('id', 'champ');
    });
  });

  describe('class fit — scout', () => {
    it('prefers scout when equipment total <= 1 and description < 200', () => {
      const scout = makeAdventurer({ id: 'scout', class: 'scout' });
      const ranger = makeAdventurer({ id: 'rang', class: 'ranger' });
      const quest = makeQuest({
        description: 'Short',
        equipment: { skillIds: ['s1'], toolIds: [], mcpServerIds: [] },
      });
      expect(autoMatch(quest, [ranger, scout], [])).toHaveProperty('id', 'scout');
    });

    it('does not prefer scout when equipment total > 1', () => {
      const scout = makeAdventurer({ id: 'scout', class: 'scout' });
      const ranger = makeAdventurer({ id: 'rang', class: 'ranger' });
      const quest = makeQuest({
        description: 'Short',
        equipment: { skillIds: ['s1', 's2'], toolIds: [], mcpServerIds: [] },
      });
      const result = autoMatch(quest, [scout, ranger], []);
      expect(result?.id).toBe('rang');
    });

    it('does not prefer scout when description >= 200', () => {
      const scout = makeAdventurer({ id: 'scout', class: 'scout' });
      const ranger = makeAdventurer({ id: 'rang', class: 'ranger' });
      const quest = makeQuest({ description: 'x'.repeat(200) });
      const result = autoMatch(quest, [scout, ranger], []);
      expect(result?.id).toBe('rang');
    });
  });

  describe('class fit — ranger (default)', () => {
    it('prefers ranger for a mid-range quest', () => {
      const ranger = makeAdventurer({ id: 'rang', class: 'ranger' });
      const scout = makeAdventurer({ id: 'scout', class: 'scout' });
      const quest = makeQuest({
        description: 'x'.repeat(300),
        equipment: { skillIds: ['s1', 's2'], toolIds: [], mcpServerIds: [] },
      });
      expect(autoMatch(quest, [scout, ranger], [])).toHaveProperty('id', 'rang');
    });

    it('falls back to any class when no ranger is available', () => {
      const scout = makeAdventurer({ id: 'scout', class: 'scout' });
      const quest = makeQuest({
        description: 'x'.repeat(300),
        equipment: { skillIds: ['s1', 's2'], toolIds: [], mcpServerIds: [] },
      });
      const result = autoMatch(quest, [scout], []);
      expect(result?.id).toBe('scout');
    });
  });

  describe('specialization match', () => {
    it('prefers adventurer whose specialization appears in description', () => {
      const specialist = makeAdventurer({ id: 'spec', class: 'scout', specializations: ['typescript'] });
      const classMatch = makeAdventurer({ id: 'class', class: 'ranger' });
      const quest = makeQuest({
        description: 'Fix the TypeScript errors in the build',
        equipment: { skillIds: ['s1', 's2'], toolIds: [], mcpServerIds: [] },
      });
      expect(autoMatch(quest, [classMatch, specialist], [])).toHaveProperty('id', 'spec');
    });

    it('prefers adventurer whose specialization appears in acceptanceCriteria', () => {
      const specialist = makeAdventurer({ id: 'spec', class: 'scout', specializations: ['sql'] });
      const classMatch = makeAdventurer({ id: 'class', class: 'ranger' });
      const quest = makeQuest({
        description: 'x'.repeat(300),
        acceptanceCriteria: ['All SQL migrations pass', 'Schema is valid'],
        equipment: { skillIds: ['s1', 's2'], toolIds: [], mcpServerIds: [] },
      });
      expect(autoMatch(quest, [classMatch, specialist], [])).toHaveProperty('id', 'spec');
    });

    it('is case-insensitive for specialization matching', () => {
      const specialist = makeAdventurer({ id: 'spec', class: 'scout', specializations: ['PYTHON'] });
      const classMatch = makeAdventurer({ id: 'class', class: 'ranger' });
      const quest = makeQuest({
        description: 'Write a python script to process data',
        equipment: { skillIds: ['s1', 's2'], toolIds: [], mcpServerIds: [] },
      });
      expect(autoMatch(quest, [classMatch, specialist], [])).toHaveProperty('id', 'spec');
    });

    it('prefers spec+class combo over spec-only', () => {
      const specAndClass = makeAdventurer({ id: 'both', class: 'ranger', specializations: ['typescript'] });
      const specOnly = makeAdventurer({ id: 'spec', class: 'scout', specializations: ['typescript'] });
      const quest = makeQuest({
        description: 'Fix typescript errors',
        equipment: { skillIds: ['s1', 's2'], toolIds: [], mcpServerIds: [] },
      });
      expect(autoMatch(quest, [specOnly, specAndClass], [])).toHaveProperty('id', 'both');
    });

    it('prefers spec-only over class-only', () => {
      const specOnly = makeAdventurer({ id: 'spec', class: 'scout', specializations: ['typescript'] });
      const classOnly = makeAdventurer({ id: 'class', class: 'ranger' });
      const quest = makeQuest({
        description: 'Fix typescript errors',
        equipment: { skillIds: ['s1', 's2'], toolIds: [], mcpServerIds: [] },
      });
      expect(autoMatch(quest, [classOnly, specOnly], [])).toHaveProperty('id', 'spec');
    });
  });

  describe('tiebreak logic', () => {
    it('prefers higher questsWon - questsLost net score', () => {
      const winner = makeAdventurer({ id: 'winner', stats: { questsWon: 10, questsLost: 2 } });
      const loser = makeAdventurer({ id: 'loser', stats: { questsWon: 3, questsLost: 5 } });
      const quest = makeQuest();
      expect(autoMatch(quest, [loser, winner], [])).toHaveProperty('id', 'winner');
    });

    it('prefers older adventurer when net scores tie', () => {
      const older = makeAdventurer({ id: 'older', createdAt: '2024-01-01T00:00:00.000Z', stats: { questsWon: 5, questsLost: 2 } });
      const newer = makeAdventurer({ id: 'newer', createdAt: '2024-06-01T00:00:00.000Z', stats: { questsWon: 5, questsLost: 2 } });
      const quest = makeQuest();
      expect(autoMatch(quest, [newer, older], [])).toHaveProperty('id', 'older');
    });

    it('treats missing stats as 0', () => {
      const noStats = makeAdventurer({ id: 'nostats', stats: {} });
      const withStats = makeAdventurer({ id: 'withstats', stats: { questsWon: 1, questsLost: 3 } });
      const quest = makeQuest();
      expect(autoMatch(quest, [withStats, noStats], [])).toHaveProperty('id', 'nostats');
    });
  });

  describe('determinism', () => {
    it('returns the same result regardless of guild array order', () => {
      const a = makeAdventurer({ id: 'a', class: 'ranger', stats: { questsWon: 3, questsLost: 1 } });
      const b = makeAdventurer({ id: 'b', class: 'ranger', stats: { questsWon: 5, questsLost: 0 } });
      const quest = makeQuest({
        description: 'x'.repeat(300),
        equipment: { skillIds: ['s1', 's2'], toolIds: [], mcpServerIds: [] },
      });
      expect(autoMatch(quest, [a, b], [])?.id).toBe(autoMatch(quest, [b, a], [])?.id);
    });
  });
});
