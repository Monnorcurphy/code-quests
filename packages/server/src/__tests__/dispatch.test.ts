import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({ default: vi.fn() }));
import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import { openDb } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { createQuestsRouter } from '../routes/quests';
import { errorHandler } from '../middleware/errors';

function makeApp() {
  const db = openDb(':memory:');
  runMigrations(db);
  const app = express();
  app.use(express.json());
  app.use('/quests', createQuestsRouter(db));
  app.use(errorHandler);
  return { app, db };
}

const GOOD_QUEST_PROPS = {
  title: 'Slay the Dragon',
  description: 'A sufficiently long description that passes the deterministic length checks in audit',
  acceptance_criteria_json: JSON.stringify(['Enemy defeated', 'Treasure returned']),
  edge_cases_json: JSON.stringify(['Dragon is asleep', 'Dragon has backup']),
};

const BAD_QUEST_PROPS = {
  title: 'Short',
  description: 'Short',
  acceptance_criteria_json: JSON.stringify([]),
  edge_cases_json: JSON.stringify([]),
};

describe('POST /quests/:id/dispatch', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
  });

  afterEach(() => {
    db.close();
  });

  it('returns 404 for unknown quest id', async () => {
    const res = await request(app).post('/quests/ghost/dispatch');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  it('returns 409 when quest is not idle', async () => {
    db.prepare(
      `INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('q-active', ...Object.values(GOOD_QUEST_PROPS), 'active');
    const res = await request(app).post('/quests/q-active/dispatch');
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already dispatched/i);
  });

  it('returns 409 with audit when quest has block gaps (no bypass)', async () => {
    db.prepare(
      `INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('q-bad', ...Object.values(BAD_QUEST_PROPS));
    const res = await request(app).post('/quests/q-bad/dispatch');
    expect(res.status).toBe(409);
    expect(res.body.error).toBeTruthy();
    expect(res.body.audit).toBeDefined();
    expect(Array.isArray(res.body.audit.gaps)).toBe(true);
    const blockGap = (res.body.audit.gaps as Array<{ severity: string }>).find(
      (g) => g.severity === 'block',
    );
    expect(blockGap).toBeDefined();
  });

  it('dispatches successfully when all checks pass', async () => {
    db.prepare(
      `INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json,
        equipment_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      'q-good',
      ...Object.values(GOOD_QUEST_PROPS),
      JSON.stringify({ skillIds: ['linters_bane'], toolIds: ['pnpm'], mcpServerIds: [] }),
    );
    const res = await request(app).post('/quests/q-good/dispatch');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
    expect(res.body.acLockedAt).toBeTruthy();
    expect(res.body.specAudit).toBeDefined();
    expect(res.body.specAudit.bypassed).toBe(false);
  });

  it('dispatches with bypass=true even when block gaps exist', async () => {
    db.prepare(
      `INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('q-bypass', ...Object.values(BAD_QUEST_PROPS));
    const res = await request(app).post('/quests/q-bypass/dispatch?bypass=true');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
    expect(res.body.specAudit.bypassed).toBe(true);
    expect(res.body.acLockedAt).toBeTruthy();
  });

  it('subsequent PATCH on acceptanceCriteria returns 400 after dispatch', async () => {
    db.prepare(
      `INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json,
        equipment_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      'q-lock',
      ...Object.values(GOOD_QUEST_PROPS),
      JSON.stringify({ skillIds: ['linters_bane'], toolIds: ['pnpm'], mcpServerIds: [] }),
    );
    const dispatch = await request(app).post('/quests/q-lock/dispatch');
    expect(dispatch.status).toBe(200);
    expect(dispatch.body.status).toBe('active');

    const patch = await request(app).patch('/quests/q-lock').send({
      acceptanceCriteria: ['New criteria'],
    });
    expect(patch.status).toBe(400);
    expect(patch.body.error).toMatch(/locked/i);
    expect(patch.body.field).toBe('acceptanceCriteria');
  });

  it('non-AC patches still allowed after dispatch', async () => {
    db.prepare(
      `INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json,
        equipment_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      'q-lock2',
      ...Object.values(GOOD_QUEST_PROPS),
      JSON.stringify({ skillIds: ['linters_bane'], toolIds: ['pnpm'], mcpServerIds: [] }),
    );
    await request(app).post('/quests/q-lock2/dispatch');
    const patch = await request(app).patch('/quests/q-lock2').send({ title: 'Updated Title' });
    expect(patch.status).toBe(200);
    expect(patch.body.title).toBe('Updated Title');
  });
});
