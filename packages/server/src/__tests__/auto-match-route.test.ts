import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import { openDb } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { seedShowcase } from '../scripts/seed-showcase';
import { createQuestsRouter } from '../routes/quests';
import { errorHandler } from '../middleware/errors';

function makeApp(db: Database.Database) {
  const app = express();
  app.use(express.json());
  app.use('/quests', createQuestsRouter(db));
  app.use(errorHandler);
  return app;
}

describe('GET /quests/:id/auto-match', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    app = makeApp(db);
  });

  afterEach(() => {
    db.close();
  });

  it('returns 404 for unknown quest id', async () => {
    const res = await request(app).get('/quests/ghost/auto-match');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  it('returns adventurerId null and a reason when no adventurers exist', async () => {
    db.prepare(
      `INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      'q-empty',
      'Slay the Dragon',
      'A quest with no adventurers',
      JSON.stringify(['Defeated']),
      JSON.stringify([]),
      'idle',
    );

    const res = await request(app).get('/quests/q-empty/auto-match');
    expect(res.status).toBe(200);
    expect(res.body.adventurerId).toBeNull();
    expect(res.body.adventurerName).toBeNull();
    expect(res.body.adventurerClass).toBeNull();
    expect(typeof res.body.reason).toBe('string');
    expect(res.body.reason.length).toBeGreaterThan(0);
  });

  it('returns the matched adventurer with a reason string', async () => {
    db.prepare(
      `INSERT INTO adventurers (id, name, class, model_id, stats_json) VALUES (?, ?, ?, ?, ?)`,
    ).run('adv-test', 'Test Ranger', 'ranger', 'haiku', JSON.stringify({ questsWon: 3 }));
    db.prepare(
      `INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      'q-match',
      'Fix the Build',
      'Some quest description for matching',
      JSON.stringify(['Build passes']),
      JSON.stringify([]),
      'idle',
    );

    const res = await request(app).get('/quests/q-match/auto-match');
    expect(res.status).toBe(200);
    expect(res.body.adventurerId).toBe('adv-test');
    expect(res.body.adventurerName).toBe('Test Ranger');
    expect(res.body.adventurerClass).toBe('ranger');
    expect(typeof res.body.reason).toBe('string');
    expect(res.body.reason).toMatch(/win|scar/i);
  });

  describe('showcase scenario', () => {
    beforeEach(() => {
      seedShowcase(db);
    });

    it('matches Brielle to the JWT quest', async () => {
      const res = await request(app).get('/quests/quest-showcase-jwt/auto-match');
      expect(res.status).toBe(200);
      expect(res.body.adventurerId).toBe('adv-showcase-brielle');
      expect(res.body.reason).toBeTruthy();
    });

    it('response shape includes adventurerId, adventurerName, adventurerClass, reason', async () => {
      const res = await request(app).get('/quests/quest-showcase-jwt/auto-match');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('adventurerId');
      expect(res.body).toHaveProperty('adventurerName');
      expect(res.body).toHaveProperty('adventurerClass');
      expect(res.body).toHaveProperty('reason');
    });
  });
});
