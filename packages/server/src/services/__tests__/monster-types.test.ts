import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb } from '../../db/connection';
import { runMigrations } from '../../db/migrator';
import {
  BUILTIN_MONSTER_TYPE_IDS,
  MONSTER_PROJECT_ID,
  getMonsterType,
  listMonsterTypes,
} from '../monster-types';

function makeDb(): Database.Database {
  const db = openDb(':memory:');
  runMigrations(db);
  return db;
}

describe('BUILTIN_MONSTER_TYPE_IDS', () => {
  it('contains exactly 10 entries', () => {
    expect(BUILTIN_MONSTER_TYPE_IDS).toHaveLength(10);
  });

  it('matches the seeded DB rows exactly', () => {
    const db = makeDb();
    const rows = db.prepare('SELECT id FROM monster_types ORDER BY id').all() as { id: string }[];
    const dbIds = rows.map((r) => r.id).sort();
    const constIds = [...BUILTIN_MONSTER_TYPE_IDS].sort();
    expect(constIds).toEqual(dbIds);
    db.close();
  });
});

describe('MONSTER_PROJECT_ID', () => {
  it('is the string "local"', () => {
    expect(MONSTER_PROJECT_ID).toBe('local');
  });
});

describe('getMonsterType', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
  });

  afterEach(() => {
    db.close();
  });

  it('returns the correct monster type for a known ID', () => {
    const mt = getMonsterType(db, 'goblin_linter');
    expect(mt).toBeDefined();
    expect(mt!.id).toBe('goblin_linter');
    expect(mt!.name).toBe('Goblin');
    expect(mt!.defaultDifficulty).toBe(1);
    expect(mt!.spritePath).toBe('monsters/goblin.png');
    expect(mt!.createdBy).toBe('system');
    expect(mt!.failureSignature).toBeTruthy();
  });

  it('returns undefined for an unknown ID (no throw)', () => {
    const mt = getMonsterType(db, 'nonexistent_monster');
    expect(mt).toBeUndefined();
  });

  it('returns all expected fields for each built-in type', () => {
    for (const id of BUILTIN_MONSTER_TYPE_IDS) {
      const mt = getMonsterType(db, id);
      expect(mt, `getMonsterType should return a result for ${id}`).toBeDefined();
      expect(typeof mt!.id).toBe('string');
      expect(typeof mt!.name).toBe('string');
      expect(typeof mt!.spritePath).toBe('string');
      expect(typeof mt!.defaultDifficulty).toBe('number');
      expect(mt!.defaultDifficulty).toBeGreaterThanOrEqual(1);
      expect(mt!.defaultDifficulty).toBeLessThanOrEqual(5);
      expect(typeof mt!.failureSignature).toBe('string');
    }
  });
});

describe('listMonsterTypes', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
  });

  afterEach(() => {
    db.close();
  });

  it('returns all 10 built-in types', () => {
    const types = listMonsterTypes(db);
    expect(types).toHaveLength(10);
  });

  it('returns types ordered by default_difficulty ascending', () => {
    const types = listMonsterTypes(db);
    for (let i = 1; i < types.length; i++) {
      expect(types[i].defaultDifficulty).toBeGreaterThanOrEqual(types[i - 1].defaultDifficulty);
    }
  });

  it('includes goblin_linter with difficulty 1 as first entry', () => {
    const types = listMonsterTypes(db);
    expect(types[0].defaultDifficulty).toBe(1);
    expect(types[0].id).toBe('goblin_linter');
  });

  it('returns an empty array when no types are seeded', () => {
    const emptyDb = openDb(':memory:');
    runMigrations(emptyDb);
    emptyDb.exec('DELETE FROM monster_types');
    const types = listMonsterTypes(emptyDb);
    expect(types).toEqual([]);
    emptyDb.close();
  });
});
