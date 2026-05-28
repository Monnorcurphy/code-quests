import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { openDb } from '../connection';
import { runMigrations } from '../migrator';
import { BUILTIN_MONSTER_TYPE_IDS } from '../../services/monster-types';

function makeDb(): Database.Database {
  const db = openDb(':memory:');
  runMigrations(db);
  return db;
}

describe('monster_types seed migration', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
  });

  afterEach(() => {
    db.close();
  });

  it('seeds all 10 built-in monster type IDs', () => {
    const rows = db.prepare('SELECT id FROM monster_types ORDER BY id').all() as { id: string }[];
    const ids = rows.map((r) => r.id).sort();
    const expected = [...BUILTIN_MONSTER_TYPE_IDS].sort();
    expect(ids).toEqual(expected);
  });

  it('seeds each type with the correct default_difficulty', () => {
    const difficulties: Record<string, number> = {
      goblin_linter: 1,
      imp_typecheck: 2,
      wraith_flaky_test: 3,
      ogre_failing_test: 3,
      hydra_ac_mismatch: 4,
      mimic_silent_failure: 4,
      wizard_env_or_dep: 3,
      troll_build_fail: 4,
      lich_repeated_failure: 5,
      dragon_epic_obstacle: 5,
    };

    for (const [id, expected] of Object.entries(difficulties)) {
      const row = db
        .prepare('SELECT default_difficulty FROM monster_types WHERE id = ?')
        .get(id) as { default_difficulty: number } | undefined;
      expect(row, `monster type '${id}' should exist`).toBeDefined();
      expect(row!.default_difficulty, `${id} difficulty`).toBe(expected);
    }
  });

  it('seeds each type with a non-empty failure_signature', () => {
    const rows = db
      .prepare('SELECT id, failure_signature FROM monster_types')
      .all() as { id: string; failure_signature: string }[];
    for (const row of rows) {
      expect(row.failure_signature, `${row.id} failure_signature`).toBeTruthy();
    }
  });

  it('seeds each type with a non-empty sprite_path', () => {
    const rows = db
      .prepare('SELECT id, sprite_path FROM monster_types')
      .all() as { id: string; sprite_path: string }[];
    for (const row of rows) {
      expect(row.sprite_path, `${row.id} sprite_path`).toMatch(/^monsters\/\w+\.png$/);
    }
  });

  it('seeds all types with created_by = system', () => {
    const rows = db
      .prepare('SELECT id, created_by FROM monster_types')
      .all() as { id: string; created_by: string }[];
    for (const row of rows) {
      expect(row.created_by, `${row.id} created_by`).toBe('system');
    }
  });

  it('is idempotent — re-running the seed SQL does not duplicate rows', () => {
    const seedSql = fs.readFileSync(
      path.join(__dirname, '..', 'migrations', '006_monster_types_seed.sql'),
      'utf8',
    );
    db.exec(seedSql);
    db.exec(seedSql);
    const count = (
      db.prepare('SELECT COUNT(*) as n FROM monster_types').get() as { n: number }
    ).n;
    expect(count).toBe(10);
  });
});
