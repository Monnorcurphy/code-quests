import { describe, it, expect, vi } from 'vitest';
import { autoMatch } from '../auto-match';
import type { Adventurer, Agent, Quest, Monster, MonsterType, ScarRecord } from '@code-quests/shared';

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
    failureSummary: null,
    inputRequest: null,
    userBlocker: null,
    currentScene: 'quest-forest',
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

// ── Scar penalty helpers ──────────────────────────────────────────────────────

function makeScar(overrides: Partial<ScarRecord> = {}): ScarRecord {
  return {
    questId: overrides.questId ?? 'q-old',
    failureSummary: overrides.failureSummary ?? 'generic failure',
    monsterIdAtFatal: overrides.monsterIdAtFatal ?? 'm-1',
    occurredAt: overrides.occurredAt ?? '2024-01-01T00:00:00.000Z',
  };
}

function makeMonster(id: string, typeId: string): Monster {
  return {
    id,
    typeId,
    name: `Monster ${id}`,
    scope: 'project',
    projectId: 'local',
    firstSeenAt: '2024-01-01T00:00:00.000Z',
    lastSeenAt: '2024-01-01T00:00:00.000Z',
    encounters: 1,
    defeats: 0,
    escapes: 0,
    calibratedDifficulty: 2,
    notes: '',
  };
}

function makeMonsterType(id: string, failureSignature: string): MonsterType {
  return {
    id,
    name: id,
    spritePath: `monsters/${id}.png`,
    defaultDifficulty: 2,
    failureSignature,
    createdBy: 'system',
  };
}

describe('autoMatch — scar penalty', () => {
  describe('no-scar baseline', () => {
    it('returns same score for adventurer with no scars (no penalty)', () => {
      const withoutScar = makeAdventurer({ id: 'clean', class: 'ranger' });
      const quest = makeQuest({ description: 'build failed compilation error' });
      const result = autoMatch(quest, [withoutScar], []);
      expect(result?.id).toBe('clean');
    });
  });

  describe('token overlap matching', () => {
    it('penalises adventurer whose scar summary overlaps >= 50% with quest text', () => {
      const scarred = makeAdventurer({
        id: 'scarred',
        class: 'ranger',
        stats: { questsWon: 5, questsLost: 0 },
        scars: [makeScar({ failureSummary: 'build failed compilation' })],
      });
      const clean = makeAdventurer({
        id: 'clean',
        class: 'ranger',
        stats: { questsWon: 5, questsLost: 0 },
      });
      // scar words {build, failed, compilation} all appear in quest description → 3/3 = 100% overlap
      const quest = makeQuest({ description: 'build failed because compilation error occurred' });
      const result = autoMatch(quest, [scarred, clean], []);
      expect(result?.id).toBe('clean');
    });

    it('does not penalise adventurer whose scar summary overlaps < 50% with quest text', () => {
      const scarred = makeAdventurer({
        id: 'scarred',
        class: 'ranger',
        stats: { questsWon: 5, questsLost: 0 },
        scars: [makeScar({ failureSummary: 'typescript import resolution error' })],
      });
      const clean = makeAdventurer({
        id: 'clean',
        class: 'scout',
        stats: { questsWon: 5, questsLost: 0 },
      });
      // Use a ranger-preferred quest: 2 skills pushes equipment total > 1, description length > 200
      const quest = makeQuest({
        description: 'build compilation failed ' + 'x'.repeat(180),
        equipment: { skillIds: ['s1', 's2'], toolIds: [], mcpServerIds: [] },
      });
      // scar words {typescript, import, resolution, error} vs quest text — no overlap
      // No penalty: scarred wins on class match (ranger vs scout for ranger quest)
      expect(autoMatch(quest, [scarred, clean], [])?.id).toBe('scarred');
    });
  });

  describe('monster type matching', () => {
    it('penalises adventurer whose scar monster type matches quest dominant type', () => {
      const monsterTypes = [makeMonsterType('troll_build_fail', '\\b(build failed|compilation error)\\b')];
      const monsters = [makeMonster('m-troll-1', 'troll_build_fail')];

      const scarred = makeAdventurer({
        id: 'scarred',
        class: 'ranger',
        stats: { questsWon: 10, questsLost: 0 },
        scars: [makeScar({ monsterIdAtFatal: 'm-troll-1', failureSummary: 'unrelated text xyz' })],
      });
      const clean = makeAdventurer({
        id: 'clean',
        class: 'ranger',
        stats: { questsWon: 10, questsLost: 0 },
      });
      // Quest triggers the troll type pattern; scarred adventurer has scar from troll
      const quest = makeQuest({ description: 'resolve the build failed compilation error' });
      const result = autoMatch(quest, [scarred, clean], [], { monsters, monsterTypes });
      expect(result?.id).toBe('clean');
    });

    it('does not penalise adventurer whose scar monster is a different type than quest dominant', () => {
      const monsterTypes = [
        makeMonsterType('troll_build_fail', '\\b(build failed|compilation error)\\b'),
        makeMonsterType('goblin_linter', '\\b(lint|eslint)\\b'),
      ];
      const monsters = [
        makeMonster('m-goblin-1', 'goblin_linter'),
        makeMonster('m-troll-1', 'troll_build_fail'),
      ];

      const adventurer = makeAdventurer({
        id: 'goblin-scarred',
        class: 'ranger',
        stats: { questsWon: 5, questsLost: 0 },
        // Scar from goblin (linter), but quest is a build/compilation quest → no match
        scars: [makeScar({ monsterIdAtFatal: 'm-goblin-1', failureSummary: 'unrelated summary' })],
      });
      const rival = makeAdventurer({
        id: 'rival',
        class: 'scout',
        stats: { questsWon: 5, questsLost: 0 },
      });
      // Use a ranger-preferred quest so goblin-scarred (ranger) wins on class match over rival (scout)
      const quest = makeQuest({
        description: 'resolve the build failed compilation error ' + 'x'.repeat(160),
        equipment: { skillIds: ['s1', 's2'], toolIds: [], mcpServerIds: [] },
      });
      // No token overlap and wrong monster type → no penalty; goblin-scarred wins on class fit
      const result = autoMatch(quest, [adventurer, rival], [], { monsters, monsterTypes });
      expect(result?.id).toBe('goblin-scarred');
    });
  });

  describe('cap behaviour', () => {
    it('caps total penalty at -30 regardless of number of matching scars', () => {
      const threeMatchingScars = [
        makeScar({ failureSummary: 'build failed compilation', questId: 'q1' }),
        makeScar({ failureSummary: 'build failed compilation', questId: 'q2' }),
        makeScar({ failureSummary: 'build failed compilation', questId: 'q3' }),
      ];
      const scarred = makeAdventurer({
        id: 'scarred',
        class: 'ranger',
        stats: { questsWon: 100, questsLost: 0 },
        scars: threeMatchingScars,
      });
      const clean = makeAdventurer({
        id: 'clean',
        class: 'ranger',
        stats: { questsWon: 0, questsLost: 0 },
      });
      // Three matching scars → penalty would be -45 without cap, but capped at -30
      // clean has net 0 wins, scarred has net 100 wins
      // Without scar penalty: scarred wins. With -30 cap scarred total score = 1 + (-30) = -29, clean = 1
      // clean should win
      const quest = makeQuest({ description: 'build failed because compilation error occurred' });
      expect(autoMatch(quest, [scarred, clean], [])?.id).toBe('clean');
    });

    it('two matching scars apply -30 penalty (cap is 2 scars × 15)', () => {
      const twoMatchingScars = [
        makeScar({ failureSummary: 'build failed compilation', questId: 'q1' }),
        makeScar({ failureSummary: 'build failed compilation', questId: 'q2' }),
      ];
      const scarred = makeAdventurer({
        id: 'scarred',
        class: 'ranger',
        stats: { questsWon: 50, questsLost: 0 },
        scars: twoMatchingScars,
      });
      const clean = makeAdventurer({
        id: 'clean',
        class: 'ranger',
        stats: { questsWon: 0, questsLost: 0 },
      });
      const quest = makeQuest({ description: 'build failed because compilation error occurred' });
      expect(autoMatch(quest, [scarred, clean], [])?.id).toBe('clean');
    });
  });

  describe('logger callback', () => {
    it('calls logger with scarPenalty when a scar matches', () => {
      const logger = vi.fn();
      const scarred = makeAdventurer({
        id: 'scarred',
        class: 'ranger',
        scars: [makeScar({ failureSummary: 'build failed compilation' })],
      });
      const quest = makeQuest({ description: 'build failed because compilation error occurred' });
      autoMatch(quest, [scarred], [], { logger });
      expect(logger).toHaveBeenCalledWith(
        expect.objectContaining({ adventurerId: 'scarred', scarPenalty: -15 }),
      );
    });

    it('does not call logger when no scars match', () => {
      const logger = vi.fn();
      const clean = makeAdventurer({ id: 'clean', class: 'ranger' });
      const quest = makeQuest({ description: 'some unrelated quest' });
      autoMatch(quest, [clean], [], { logger });
      expect(logger).not.toHaveBeenCalled();
    });
  });

  describe('showcase scenario: scar from JWT quest affects future matching', () => {
    it('Brielle with JWT scar scores lower than a clean champion for a type-heavy quest', () => {
      const jwtScar: ScarRecord = {
        questId: 'quest-showcase-jwt',
        failureSummary: 'Repeated type errors escalated to a Lich and the adventurer was defeated.',
        monsterIdAtFatal: 'imp-jwt-01',
        occurredAt: '2024-01-01T00:00:00.000Z',
      };
      const brielle = makeAdventurer({
        id: 'adv-showcase-brielle',
        class: 'champion',
        stats: { questsWon: 8, questsLost: 1 },
        scars: [jwtScar],
      });
      const newcomer = makeAdventurer({
        id: 'adv-fresh-champion',
        class: 'champion',
        stats: { questsWon: 3, questsLost: 0 },
        scars: [],
      });
      const typeHeavyQuest = makeQuest({
        description: 'Migrate to JWT tokens and resolve all type errors in the auth module.',
        equipment: { skillIds: ['s1', 's2', 's3'], toolIds: ['t1', 't2', 't3'], mcpServerIds: [] },
      });
      const monsters = [makeMonster('imp-jwt-01', 'imp_typecheck')];
      const monsterTypes = [makeMonsterType('imp_typecheck', 'type error|TS\\d{4}')];

      const result = autoMatch(typeHeavyQuest, [brielle, newcomer], [], { monsters, monsterTypes });
      // The newcomer (no scars) should beat Brielle (relevant scar penalty) on this JWT quest
      expect(result?.id).toBe('adv-fresh-champion');
    });
  });
});
