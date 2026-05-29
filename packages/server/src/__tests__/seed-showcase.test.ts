import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({ default: vi.fn() }));

import Database from 'better-sqlite3';
import express from 'express';
import request from 'supertest';
import { openDb } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { seedShowcase } from '../scripts/seed-showcase';
import { resetShowcase } from '../scripts/reset-showcase';
import { createShowcaseRouter } from '../routes/showcase';
import { errorHandler } from '../middleware/errors';

function makeDb(): Database.Database {
  const db = openDb(':memory:');
  runMigrations(db);
  return db;
}

function countRows(db: Database.Database, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) as n FROM ${table}`).get() as { n: number };
  return row.n;
}

function getShowcaseCounts(db: Database.Database) {
  return {
    epics: (
      db
        .prepare(`SELECT COUNT(*) as n FROM epics WHERE id = 'epic-showcase-auth'`)
        .get() as { n: number }
    ).n,
    adventurers: (
      db
        .prepare(
          `SELECT COUNT(*) as n FROM adventurers WHERE id LIKE 'adv-showcase-%'`,
        )
        .get() as { n: number }
    ).n,
    quests: (
      db
        .prepare(
          `SELECT COUNT(*) as n FROM quests WHERE id LIKE 'quest-showcase-%'`,
        )
        .get() as { n: number }
    ).n,
    monsters: (
      db
        .prepare(
          `SELECT COUNT(*) as n FROM monsters WHERE id IN ('grognak-the-lint-goblin','the-jwt-hydra')`,
        )
        .get() as { n: number }
    ).n,
  };
}

describe('seedShowcase', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
  });

  afterEach(() => {
    db.close();
  });

  it('returns the showcase epic id', () => {
    const epicId = seedShowcase(db);
    expect(epicId).toBe('epic-showcase-auth');
  });

  it('inserts 1 epic, 3 adventurers, 3 quests, and 2 monsters', () => {
    seedShowcase(db);
    const counts = getShowcaseCounts(db);
    expect(counts.epics).toBe(1);
    expect(counts.adventurers).toBe(3);
    expect(counts.quests).toBe(3);
    expect(counts.monsters).toBe(2);
  });

  it('is idempotent — running twice produces the same row counts', () => {
    seedShowcase(db);
    const after1 = getShowcaseCounts(db);
    seedShowcase(db);
    const after2 = getShowcaseCounts(db);
    expect(after2).toEqual(after1);
  });

  it('is idempotent for total DB row counts — no duplicates on second run', () => {
    seedShowcase(db);
    const totalAfter1 = {
      epics: countRows(db, 'epics'),
      adventurers: countRows(db, 'adventurers'),
      quests: countRows(db, 'quests'),
      monsters: countRows(db, 'monsters'),
    };
    seedShowcase(db);
    const totalAfter2 = {
      epics: countRows(db, 'epics'),
      adventurers: countRows(db, 'adventurers'),
      quests: countRows(db, 'quests'),
      monsters: countRows(db, 'monsters'),
    };
    expect(totalAfter2).toEqual(totalAfter1);
  });

  it('all quest epic_id FKs resolve', () => {
    seedShowcase(db);
    const orphans = db
      .prepare(
        `SELECT q.id FROM quests q
         LEFT JOIN epics e ON q.epic_id = e.id
         WHERE q.id LIKE 'quest-showcase-%' AND e.id IS NULL`,
      )
      .all();
    expect(orphans).toHaveLength(0);
  });

  it('all monster type_id FKs resolve', () => {
    seedShowcase(db);
    const orphans = db
      .prepare(
        `SELECT m.id FROM monsters m
         LEFT JOIN monster_types mt ON m.type_id = mt.id
         WHERE m.id IN ('grognak-the-lint-goblin','the-jwt-hydra') AND mt.id IS NULL`,
      )
      .all();
    expect(orphans).toHaveLength(0);
  });

  it('quest equipment skillIds reference existing skills', () => {
    seedShowcase(db);
    const quests = db
      .prepare(`SELECT id, equipment_json FROM quests WHERE id LIKE 'quest-showcase-%'`)
      .all() as { id: string; equipment_json: string }[];

    for (const quest of quests) {
      const equipment = JSON.parse(quest.equipment_json) as {
        skillIds: string[];
        toolIds: string[];
        mcpServerIds: string[];
      };

      for (const skillId of equipment.skillIds) {
        const skill = db.prepare(`SELECT id FROM skills WHERE id = ?`).get(skillId);
        expect(skill, `skill "${skillId}" referenced by quest "${quest.id}" must exist`).toBeTruthy();
      }

      for (const toolId of equipment.toolIds) {
        const tool = db.prepare(`SELECT id FROM tools WHERE id = ?`).get(toolId);
        expect(tool, `tool "${toolId}" referenced by quest "${quest.id}" must exist`).toBeTruthy();
      }

      for (const mcpId of equipment.mcpServerIds) {
        const mcp = db.prepare(`SELECT id FROM mcp_servers WHERE id = ?`).get(mcpId);
        expect(mcp, `mcp_server "${mcpId}" referenced by quest "${quest.id}" must exist`).toBeTruthy();
      }
    }
  });

  it('seeded quests have no blocking SpecAudit gaps (description and ACs satisfy deterministic rules)', () => {
    seedShowcase(db);
    const quests = db
      .prepare(
        `SELECT title, description, acceptance_criteria_json FROM quests WHERE id LIKE 'quest-showcase-%'`,
      )
      .all() as { title: string; description: string; acceptance_criteria_json: string }[];

    for (const quest of quests) {
      const acs = JSON.parse(quest.acceptance_criteria_json) as string[];

      // description must be >= 20 chars (block-severity rule)
      expect(
        quest.description.trim().length,
        `quest "${quest.title}" description must be >= 20 chars`,
      ).toBeGreaterThanOrEqual(20);

      // must have at least one AC with >= 5 chars (block-severity rule)
      const hasValidAc = acs.length > 0 && acs.some((ac) => ac.trim().length >= 5);
      expect(hasValidAc, `quest "${quest.title}" must have at least one AC >= 5 chars`).toBe(true);
    }
  });

  it('Brielle has 8 prior wins in stats_json', () => {
    seedShowcase(db);
    const row = db
      .prepare(`SELECT stats_json FROM adventurers WHERE id = 'adv-showcase-brielle'`)
      .get() as { stats_json: string } | undefined;
    expect(row).toBeTruthy();
    const stats = JSON.parse(row!.stats_json) as { questsWon: number };
    expect(stats.questsWon).toBe(8);
  });

  it('Tess has 1 scar (hydra_ac_mismatch) in scars_json', () => {
    seedShowcase(db);
    const row = db
      .prepare(`SELECT scars_json FROM adventurers WHERE id = 'adv-showcase-tess'`)
      .get() as { scars_json: string } | undefined;
    expect(row).toBeTruthy();
    const scars = JSON.parse(row!.scars_json) as Array<{ monsterIdAtFatal: string }>;
    expect(scars).toHaveLength(1);
    expect(scars[0]?.monsterIdAtFatal).toBe('the-jwt-hydra');
  });

  it('Rook is brand-new with 0 wins', () => {
    seedShowcase(db);
    const row = db
      .prepare(`SELECT stats_json FROM adventurers WHERE id = 'adv-showcase-rook'`)
      .get() as { stats_json: string } | undefined;
    expect(row).toBeTruthy();
    const stats = JSON.parse(row!.stats_json) as { questsWon: number };
    expect(stats.questsWon).toBe(0);
  });

  it('grognak has encounters=12 and defeats=11 (guild-scope nemesis)', () => {
    seedShowcase(db);
    const row = db
      .prepare(
        `SELECT encounters, defeats, scope FROM monsters WHERE id = 'grognak-the-lint-goblin'`,
      )
      .get() as { encounters: number; defeats: number; scope: string } | undefined;
    expect(row).toBeTruthy();
    expect(row!.encounters).toBe(12);
    expect(row!.defeats).toBe(11);
    expect(row!.scope).toBe('guild');
  });

  it('the-jwt-hydra has calibrated_difficulty=4 (project-scope)', () => {
    seedShowcase(db);
    const row = db
      .prepare(
        `SELECT calibrated_difficulty, scope FROM monsters WHERE id = 'the-jwt-hydra'`,
      )
      .get() as { calibrated_difficulty: number; scope: string } | undefined;
    expect(row).toBeTruthy();
    expect(row!.calibrated_difficulty).toBe(4);
    expect(row!.scope).toBe('project');
  });

  it('ac_cartographer is set to candidate status', () => {
    seedShowcase(db);
    const row = db
      .prepare(`SELECT status FROM skills WHERE id = 'ac_cartographer'`)
      .get() as { status: string } | undefined;
    expect(row?.status).toBe('candidate');
  });

  it('linters_bane hit_count is 11', () => {
    seedShowcase(db);
    const row = db
      .prepare(`SELECT hit_count FROM skills WHERE id = 'linters_bane'`)
      .get() as { hit_count: number } | undefined;
    expect(row?.hit_count).toBe(11);
  });

  it('Adventurer.stats.monstersSlain references valid MonsterType ids', () => {
    seedShowcase(db);
    const adventurers = db
      .prepare(`SELECT id, stats_json FROM adventurers WHERE id LIKE 'adv-showcase-%'`)
      .all() as { id: string; stats_json: string }[];

    for (const adv of adventurers) {
      const stats = JSON.parse(adv.stats_json) as {
        monstersSlain?: Record<string, number>;
      };
      if (!stats.monstersSlain) continue;

      for (const typeId of Object.keys(stats.monstersSlain)) {
        const mt = db.prepare(`SELECT id FROM monster_types WHERE id = ?`).get(typeId);
        expect(
          mt,
          `monstersSlain key "${typeId}" on adventurer "${adv.id}" must be a valid monster_type id`,
        ).toBeTruthy();
      }
    }
  });
});

describe('resetShowcase', () => {
  let db: Database.Database;
  const originalEnv = process.env['CODE_QUESTS_ENV'];

  beforeEach(() => {
    db = makeDb();
    process.env['CODE_QUESTS_ENV'] = 'demo';
  });

  afterEach(() => {
    db.close();
    if (originalEnv === undefined) {
      delete process.env['CODE_QUESTS_ENV'];
    } else {
      process.env['CODE_QUESTS_ENV'] = originalEnv;
    }
  });

  it('throws when CODE_QUESTS_ENV is not demo', () => {
    process.env['CODE_QUESTS_ENV'] = 'development';
    expect(() => resetShowcase(db)).toThrow('CODE_QUESTS_ENV=demo');
  });

  it('clears and re-seeds showcase data', () => {
    seedShowcase(db);
    resetShowcase(db);
    const counts = getShowcaseCounts(db);
    expect(counts.epics).toBe(1);
    expect(counts.adventurers).toBe(3);
    expect(counts.quests).toBe(3);
  });

  it('produces the same row counts as a fresh seed after reset', () => {
    seedShowcase(db);
    const afterSeed = getShowcaseCounts(db);
    resetShowcase(db);
    const afterReset = getShowcaseCounts(db);
    expect(afterReset).toEqual(afterSeed);
  });
});

describe('POST /showcase/reset', () => {
  let db: Database.Database;
  let app: express.Express;
  const originalEnv = process.env['CODE_QUESTS_ENV'];

  function makeApp(envValue?: string) {
    if (envValue !== undefined) {
      process.env['CODE_QUESTS_ENV'] = envValue;
    } else {
      delete process.env['CODE_QUESTS_ENV'];
    }
    const d = makeDb();
    const a = express();
    a.use(express.json());
    a.use('/showcase', createShowcaseRouter(d));
    a.use(errorHandler);
    return { app: a, db: d };
  }

  afterEach(() => {
    db?.close();
    if (originalEnv === undefined) {
      delete process.env['CODE_QUESTS_ENV'];
    } else {
      process.env['CODE_QUESTS_ENV'] = originalEnv;
    }
  });

  it('returns 403 when CODE_QUESTS_ENV is not demo', async () => {
    ({ app, db } = makeApp('production'));
    const res = await request(app).post('/showcase/reset');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/demo/i);
  });

  it('returns 403 when CODE_QUESTS_ENV is unset', async () => {
    ({ app, db } = makeApp(undefined));
    const res = await request(app).post('/showcase/reset');
    expect(res.status).toBe(403);
  });

  it('returns 200 and epicId when CODE_QUESTS_ENV=demo', async () => {
    ({ app, db } = makeApp('demo'));
    const res = await request(app).post('/showcase/reset');
    expect(res.status).toBe(200);
    expect(res.body.epicId).toBe('epic-showcase-auth');
  });

  it('seeds showcase data into the DB after reset', async () => {
    ({ app, db } = makeApp('demo'));
    await request(app).post('/showcase/reset');
    const epic = db.prepare(`SELECT id FROM epics WHERE id = 'epic-showcase-auth'`).get();
    expect(epic).toBeTruthy();
  });
});
