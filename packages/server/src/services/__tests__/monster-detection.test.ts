import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb } from '../../db/connection';
import { runMigrations } from '../../db/migrator';
import {
  classifyCombatEvent,
  recordEncounter,
  resolveEncounter,
  recalibrateDifficulty,
} from '../monster-detection';

function makeDb(): Database.Database {
  const db = openDb(':memory:');
  runMigrations(db);
  return db;
}

function makeQuest(db: Database.Database, id = 'quest-1'): string {
  db.prepare(
    `INSERT INTO adventurers (id, name, class, model_id)
     VALUES ('adv-1', 'Test Hero', 'champion', 'claude-3')`,
  ).run();
  db.prepare(
    `INSERT INTO quests (id, title, description, adventurer_id)
     VALUES (?, 'Test Quest', 'desc', 'adv-1')`,
  ).run(id);
  return id;
}

describe('classifyCombatEvent', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
  });

  afterEach(() => {
    db.close();
  });

  it('returns the monster type when monsterTypeId is explicit and valid', () => {
    const event = {
      type: 'combat' as const,
      timestamp: new Date().toISOString(),
      monsterTypeId: 'goblin_linter',
      message: 'something happened',
    };
    const result = classifyCombatEvent(db, event);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('goblin_linter');
  });

  it('falls back to regex when monsterTypeId is unknown', () => {
    const event = {
      type: 'combat' as const,
      timestamp: new Date().toISOString(),
      monsterTypeId: 'nonexistent_type',
      message: 'eslint error: missing semicolon',
    };
    const result = classifyCombatEvent(db, event);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('goblin_linter');
  });

  it('classifies by regex on message when no monsterTypeId provided', () => {
    const event = {
      type: 'combat' as const,
      timestamp: new Date().toISOString(),
      message: 'typescript error TS2304: Cannot find name',
    };
    const result = classifyCombatEvent(db, event);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('imp_typecheck');
  });

  it('returns null when no type matches the message', () => {
    const event = {
      type: 'combat' as const,
      timestamp: new Date().toISOString(),
      message: 'xyzzy nothing happened',
    };
    const result = classifyCombatEvent(db, event);
    expect(result).toBeNull();
  });

  it('user-defined type classifies before built-in when both match', () => {
    db.prepare(
      `INSERT INTO monster_types (id, name, sprite_path, default_difficulty, failure_signature, created_by)
       VALUES ('user:eslint-unused', 'Slug', 'monsters/slug.png', 1, 'eslint.*unused', 'user')`,
    ).run();

    const event = {
      type: 'combat' as const,
      timestamp: new Date().toISOString(),
      message: 'eslint no-unused-vars',
    };
    const result = classifyCombatEvent(db, event);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('user:eslint-unused');
  });

  it('skips user type with invalid regex and falls through to built-in', () => {
    db.prepare(
      `INSERT INTO monster_types (id, name, sprite_path, default_difficulty, failure_signature, created_by)
       VALUES ('user:bad-regex', 'Broken', 'monsters/broken.png', 1, '[invalid(', 'user')`,
    ).run();

    const event = {
      type: 'combat' as const,
      timestamp: new Date().toISOString(),
      message: 'eslint error: missing semicolon',
    };
    const result = classifyCombatEvent(db, event);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('goblin_linter');
  });
});

describe('recordEncounter', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
    makeQuest(db, 'quest-1');
  });

  afterEach(() => {
    db.close();
  });

  it('creates a new monster row on first encounter', () => {
    const { monster, encounter } = recordEncounter(db, {
      questId: 'quest-1',
      monsterTypeId: 'goblin_linter',
      combatLogEntry: 'lint error',
    });

    expect(monster.id).toBeTruthy();
    expect(monster.typeId).toBe('goblin_linter');
    expect(monster.name).toMatch(/\bGoblin\b/);
    expect(monster.scope).toBe('project');
    expect(monster.encounters).toBe(1);
    expect(monster.defeats).toBe(0);
    expect(encounter.id).toBeTruthy();
    expect(encounter.monsterId).toBe(monster.id);
    expect(encounter.questId).toBe('quest-1');
    expect(encounter.outcome).toBe('escape');
    expect(JSON.parse(encounter.combatLogJson)).toContain('lint error');
  });

  it('reuses the existing monster on second encounter in same quest', () => {
    const first = recordEncounter(db, {
      questId: 'quest-1',
      monsterTypeId: 'goblin_linter',
      combatLogEntry: 'first lint',
    });
    const second = recordEncounter(db, {
      questId: 'quest-1',
      monsterTypeId: 'goblin_linter',
      combatLogEntry: 'second lint',
    });

    expect(second.monster.id).toBe(first.monster.id);
    expect(second.monster.encounters).toBe(2);
  });

  it('reuses the existing monster across different quests (project-scope)', () => {
    db.prepare(
      `INSERT INTO quests (id, title, description, adventurer_id)
       VALUES ('quest-2', 'Quest 2', 'desc', 'adv-1')`,
    ).run();

    const first = recordEncounter(db, {
      questId: 'quest-1',
      monsterTypeId: 'goblin_linter',
      combatLogEntry: 'q1 lint',
    });
    const second = recordEncounter(db, {
      questId: 'quest-2',
      monsterTypeId: 'goblin_linter',
      combatLogEntry: 'q2 lint',
    });

    expect(second.monster.id).toBe(first.monster.id);
    expect(second.monster.encounters).toBe(2);
  });

  it('creates separate encounters per call', () => {
    const first = recordEncounter(db, {
      questId: 'quest-1',
      monsterTypeId: 'goblin_linter',
      combatLogEntry: 'a',
    });
    const second = recordEncounter(db, {
      questId: 'quest-1',
      monsterTypeId: 'goblin_linter',
      combatLogEntry: 'b',
    });

    expect(first.encounter.id).not.toBe(second.encounter.id);
  });
});

describe('resolveEncounter', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
    makeQuest(db, 'quest-1');
  });

  afterEach(() => {
    db.close();
  });

  it('sets outcome to victory and increments monster defeats', () => {
    const { monster, encounter } = recordEncounter(db, {
      questId: 'quest-1',
      monsterTypeId: 'goblin_linter',
      combatLogEntry: 'lint',
    });

    const resolved = resolveEncounter(db, encounter.id, 'victory');
    expect(resolved.outcome).toBe('victory');

    const row = db.prepare('SELECT defeats FROM monsters WHERE id = ?').get(monster.id) as { defeats: number };
    expect(row.defeats).toBe(1);
  });

  it('sets outcome to escape and increments monster escapes', () => {
    const { monster, encounter } = recordEncounter(db, {
      questId: 'quest-1',
      monsterTypeId: 'goblin_linter',
      combatLogEntry: 'lint',
    });

    const resolved = resolveEncounter(db, encounter.id, 'escape');
    expect(resolved.outcome).toBe('escape');

    const row = db.prepare('SELECT escapes FROM monsters WHERE id = ?').get(monster.id) as { escapes: number };
    expect(row.escapes).toBe(1);
  });

  it('sets outcome to defeat and increments monster escapes', () => {
    const { monster, encounter } = recordEncounter(db, {
      questId: 'quest-1',
      monsterTypeId: 'goblin_linter',
      combatLogEntry: 'lint',
    });

    const resolved = resolveEncounter(db, encounter.id, 'defeat');
    expect(resolved.outcome).toBe('defeat');

    const row = db.prepare('SELECT escapes FROM monsters WHERE id = ?').get(monster.id) as { escapes: number };
    expect(row.escapes).toBe(1);
  });

  it('appends extraLogEntries to combat log', () => {
    const { encounter } = recordEncounter(db, {
      questId: 'quest-1',
      monsterTypeId: 'goblin_linter',
      combatLogEntry: 'first entry',
    });

    const resolved = resolveEncounter(db, encounter.id, 'victory', ['second entry']);
    const log = JSON.parse(resolved.combatLogJson) as string[];
    expect(log).toContain('first entry');
    expect(log).toContain('second entry');
  });

  it('throws when encounter id does not exist', () => {
    expect(() => resolveEncounter(db, 'nonexistent-id', 'victory')).toThrow();
  });

  it('calls recalibrateDifficulty after resolution', () => {
    const { monster, encounter } = recordEncounter(db, {
      questId: 'quest-1',
      monsterTypeId: 'goblin_linter',
      combatLogEntry: 'lint',
    });

    resolveEncounter(db, encounter.id, 'victory');

    const row = db
      .prepare('SELECT calibrated_difficulty FROM monsters WHERE id = ?')
      .get(monster.id) as { calibrated_difficulty: number };
    expect(row.calibrated_difficulty).toBeGreaterThanOrEqual(1);
    expect(row.calibrated_difficulty).toBeLessThanOrEqual(5);
  });
});

describe('recalibrateDifficulty', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
  });

  afterEach(() => {
    db.close();
  });

  function insertMonster(typeId: string, encounters: number, defeats: number): string {
    const id = `mon-${Math.random()}`;
    db.prepare(
      `INSERT INTO monsters (id, type_id, name, scope, encounters, defeats, escapes, calibrated_difficulty, notes)
       VALUES (?, ?, 'Test', 'project', ?, ?, 0, 1, '')`,
    ).run(id, typeId, encounters, defeats);
    return id;
  }

  it('decreases difficulty when defeat ratio >= 0.8', () => {
    const monsterId = insertMonster('goblin_linter', 5, 5);
    recalibrateDifficulty(db, monsterId);
    const row = db
      .prepare('SELECT calibrated_difficulty FROM monsters WHERE id = ?')
      .get(monsterId) as { calibrated_difficulty: number };
    // goblin_linter defaultDifficulty = 1; clamped to min 1
    expect(row.calibrated_difficulty).toBe(1);
  });

  it('increases difficulty when defeat ratio <= 0.3', () => {
    const monsterId = insertMonster('imp_typecheck', 10, 1);
    recalibrateDifficulty(db, monsterId);
    const row = db
      .prepare('SELECT calibrated_difficulty FROM monsters WHERE id = ?')
      .get(monsterId) as { calibrated_difficulty: number };
    // imp_typecheck defaultDifficulty = 2; should become 3
    expect(row.calibrated_difficulty).toBe(3);
  });

  it('keeps default difficulty for ratios between 0.3 and 0.8', () => {
    const monsterId = insertMonster('imp_typecheck', 10, 5);
    recalibrateDifficulty(db, monsterId);
    const row = db
      .prepare('SELECT calibrated_difficulty FROM monsters WHERE id = ?')
      .get(monsterId) as { calibrated_difficulty: number };
    // ratio 0.5 — stays at defaultDifficulty = 2
    expect(row.calibrated_difficulty).toBe(2);
  });

  it('clamps calibrated difficulty to minimum of 1', () => {
    const monsterId = insertMonster('goblin_linter', 10, 10);
    recalibrateDifficulty(db, monsterId);
    const row = db
      .prepare('SELECT calibrated_difficulty FROM monsters WHERE id = ?')
      .get(monsterId) as { calibrated_difficulty: number };
    expect(row.calibrated_difficulty).toBeGreaterThanOrEqual(1);
  });

  it('clamps calibrated difficulty to maximum of 5', () => {
    const monsterId = insertMonster('dragon_epic_obstacle', 10, 0);
    recalibrateDifficulty(db, monsterId);
    const row = db
      .prepare('SELECT calibrated_difficulty FROM monsters WHERE id = ?')
      .get(monsterId) as { calibrated_difficulty: number };
    // dragon defaultDifficulty = 5; ratio 0 <= 0.3; 5+1=6, clamped to 5
    expect(row.calibrated_difficulty).toBe(5);
  });

  it('does nothing when encounters is 0', () => {
    const monsterId = insertMonster('goblin_linter', 0, 0);
    recalibrateDifficulty(db, monsterId);
    const row = db
      .prepare('SELECT calibrated_difficulty FROM monsters WHERE id = ?')
      .get(monsterId) as { calibrated_difficulty: number };
    expect(row.calibrated_difficulty).toBe(1);
  });
});
