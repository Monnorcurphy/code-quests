import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { openDb } from '../../db/connection';
import { runMigrations } from '../../db/migrator';
import {
  evaluateSkillCandidate,
  CANDIDATE_VICTORY_THRESHOLD,
} from '../skill-candidate-detection';

function makeDb(): Database.Database {
  const db = openDb(':memory:');
  runMigrations(db);
  return db;
}

function insertAdventurer(db: Database.Database, id: string): void {
  db.prepare(
    `INSERT INTO adventurers (id, name, class, model_id) VALUES (?, 'Hero', 'champion', 'claude-3')`,
  ).run(id);
}

function insertQuest(db: Database.Database, id: string, adventurerId: string): void {
  db.prepare(
    `INSERT INTO quests (id, title, description, adventurer_id) VALUES (?, 'Quest', 'desc', ?)`,
  ).run(id, adventurerId);
}

function ensureMonster(db: Database.Database, monsterTypeId: string): string {
  const existing = db
    .prepare("SELECT id FROM monsters WHERE type_id = ? AND scope = 'project' LIMIT 1")
    .get(monsterTypeId) as { id: string } | undefined;
  if (existing) return existing.id;

  const monsterId = randomUUID();
  db.prepare(
    `INSERT INTO monsters
       (id, type_id, name, scope, project_id, first_seen_at, last_seen_at,
        encounters, defeats, escapes, calibrated_difficulty, notes)
     VALUES (?, ?, 'Test Monster', 'project', 'proj-1',
             datetime('now'), datetime('now'), 0, 0, 0, 1, '')`,
  ).run(monsterId, monsterTypeId);
  return monsterId;
}

function insertVictory(db: Database.Database, questId: string, monsterTypeId: string): void {
  const monsterId = ensureMonster(db, monsterTypeId);
  db.prepare(
    `INSERT INTO monster_encounters
       (id, monster_id, quest_id, outcome, combat_log_json, loot_json)
     VALUES (?, ?, ?, 'victory', '[]', '[]')`,
  ).run(randomUUID(), monsterId, questId);
}

describe('evaluateSkillCandidate', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
    insertAdventurer(db, 'adv-1');
    insertQuest(db, 'quest-1', 'adv-1');
  });

  afterEach(() => {
    db.close();
  });

  it('returns no candidate after one victory', () => {
    insertVictory(db, 'quest-1', 'goblin_linter');
    const result = evaluateSkillCandidate(db, {
      adventurerId: 'adv-1',
      monsterTypeId: 'goblin_linter',
    });
    expect(result.created).toBe(false);
    expect(result.updated).toBe(false);
    expect(result.skillId).toBeUndefined();
  });

  it(`creates a candidate after ${CANDIDATE_VICTORY_THRESHOLD} victories by same adventurer and monster type`, () => {
    for (let i = 0; i < CANDIDATE_VICTORY_THRESHOLD; i++) {
      insertVictory(db, 'quest-1', 'goblin_linter');
    }

    const result = evaluateSkillCandidate(db, {
      adventurerId: 'adv-1',
      monsterTypeId: 'goblin_linter',
    });

    expect(result.created).toBe(true);
    expect(result.updated).toBe(false);
    expect(result.skillId).toBeTruthy();

    const skill = db
      .prepare('SELECT * FROM skills WHERE id = ?')
      .get(result.skillId) as Record<string, unknown>;
    expect(skill['status']).toBe('candidate');
    expect(skill['created_by']).toBe('system');
    expect(skill['hit_count']).toBe(1);
    expect(skill['detected_for_adventurer_id']).toBe('adv-1');
    expect(JSON.parse(skill['monster_type_ids_json'] as string)).toContain('goblin_linter');
  });

  it('increments hit_count on the existing candidate on the next call instead of creating a duplicate', () => {
    for (let i = 0; i < CANDIDATE_VICTORY_THRESHOLD; i++) {
      insertVictory(db, 'quest-1', 'goblin_linter');
    }

    const firstResult = evaluateSkillCandidate(db, {
      adventurerId: 'adv-1',
      monsterTypeId: 'goblin_linter',
    });
    expect(firstResult.created).toBe(true);

    insertVictory(db, 'quest-1', 'goblin_linter');

    const secondResult = evaluateSkillCandidate(db, {
      adventurerId: 'adv-1',
      monsterTypeId: 'goblin_linter',
    });
    expect(secondResult.created).toBe(false);
    expect(secondResult.updated).toBe(true);
    expect(secondResult.skillId).toBe(firstResult.skillId);

    const skill = db
      .prepare('SELECT hit_count FROM skills WHERE id = ?')
      .get(firstResult.skillId) as { hit_count: number };
    expect(skill.hit_count).toBe(2);

    const { count } = db
      .prepare('SELECT COUNT(*) as count FROM skills WHERE detected_for_adventurer_id IS NOT NULL')
      .get() as { count: number };
    expect(count).toBe(1);
  });

  it('does not create a candidate when the threshold victories come from different adventurers', () => {
    insertAdventurer(db, 'adv-2');
    insertAdventurer(db, 'adv-3');
    insertQuest(db, 'quest-2', 'adv-2');
    insertQuest(db, 'quest-3', 'adv-3');

    insertVictory(db, 'quest-1', 'goblin_linter');
    insertVictory(db, 'quest-2', 'goblin_linter');
    insertVictory(db, 'quest-3', 'goblin_linter');

    const r1 = evaluateSkillCandidate(db, { adventurerId: 'adv-1', monsterTypeId: 'goblin_linter' });
    const r2 = evaluateSkillCandidate(db, { adventurerId: 'adv-2', monsterTypeId: 'goblin_linter' });
    const r3 = evaluateSkillCandidate(db, { adventurerId: 'adv-3', monsterTypeId: 'goblin_linter' });

    expect(r1.created).toBe(false);
    expect(r2.created).toBe(false);
    expect(r3.created).toBe(false);

    const { count } = db
      .prepare('SELECT COUNT(*) as count FROM skills WHERE detected_for_adventurer_id IS NOT NULL')
      .get() as { count: number };
    expect(count).toBe(0);
  });

  it('bumps hit_count on an active skill and does not create a new candidate', () => {
    for (let i = 0; i < CANDIDATE_VICTORY_THRESHOLD; i++) {
      insertVictory(db, 'quest-1', 'goblin_linter');
    }

    const candidateResult = evaluateSkillCandidate(db, {
      adventurerId: 'adv-1',
      monsterTypeId: 'goblin_linter',
    });
    expect(candidateResult.created).toBe(true);

    db.prepare(`UPDATE skills SET status = 'active' WHERE id = ?`).run(candidateResult.skillId);

    insertVictory(db, 'quest-1', 'goblin_linter');

    const result = evaluateSkillCandidate(db, {
      adventurerId: 'adv-1',
      monsterTypeId: 'goblin_linter',
    });
    expect(result.created).toBe(false);
    expect(result.updated).toBe(true);
    expect(result.skillId).toBe(candidateResult.skillId);

    const { count } = db
      .prepare('SELECT COUNT(*) as count FROM skills WHERE detected_for_adventurer_id IS NOT NULL')
      .get() as { count: number };
    expect(count).toBe(1);

    const skill = db
      .prepare('SELECT hit_count FROM skills WHERE id = ?')
      .get(candidateResult.skillId) as { hit_count: number };
    expect(skill.hit_count).toBe(2);
  });

  it('throws FK error when inserting a candidate with a non-existent adventurer id (proves FK pragma is live)', () => {
    expect(() => {
      db.prepare(
        `INSERT INTO skills
           (id, name, monster_type_ids_json, status, created_by, hit_count, implementation,
            detected_for_adventurer_id)
         VALUES ('skill-fk-test', 'Test', '[]', 'candidate', 'system', 0, '', 'nonexistent-adv')`,
      ).run();
    }).toThrow();
  });
});
