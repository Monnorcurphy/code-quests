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

function insertAdventurer(db: Database.Database, id: string) {
  db.prepare(
    `INSERT INTO adventurers (id, name, class, model_id) VALUES (?, ?, ?, ?)`,
  ).run(id, `Hero ${id}`, 'ranger', 'claude-haiku');
}

const GOOD_QUEST_PROPS = {
  title: 'Slay the Dragon',
  description: 'A sufficiently long description that passes the deterministic length checks in audit',
  acceptance_criteria_json: JSON.stringify(['Enemy defeated', 'Treasure returned']),
  edge_cases_json: JSON.stringify(['Dragon is asleep', 'Dragon has backup']),
};

function insertActiveQuest(db: Database.Database, id: string, advId: string) {
  db.prepare(
    `INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json, status, adventurer_id, equipment_json, ac_locked_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?, datetime('now'))`,
  ).run(
    id,
    GOOD_QUEST_PROPS.title,
    GOOD_QUEST_PROPS.description,
    GOOD_QUEST_PROPS.acceptance_criteria_json,
    GOOD_QUEST_PROPS.edge_cases_json,
    advId,
    JSON.stringify({ skillIds: [], toolIds: [], mcpServerIds: [] }),
  );
}

function insertAgent(db: Database.Database, agentId: string, questId: string, advId: string) {
  db.prepare(
    `INSERT INTO agents (id, adventurer_id, quest_id) VALUES (?, ?, ?)`,
  ).run(agentId, advId, questId);
}

describe('POST /quests/:id/complete', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
    insertAdventurer(db, 'adv-1');
  });

  afterEach(() => { db.close(); });

  it('returns 404 for unknown quest', async () => {
    const res = await request(app).post('/quests/ghost/complete');
    expect(res.status).toBe(404);
  });

  it('returns 409 when quest is not active', async () => {
    db.prepare(
      `INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json, status)
       VALUES (?, ?, ?, ?, ?, 'idle')`,
    ).run('q-idle', GOOD_QUEST_PROPS.title, GOOD_QUEST_PROPS.description,
      GOOD_QUEST_PROPS.acceptance_criteria_json, GOOD_QUEST_PROPS.edge_cases_json);
    const res = await request(app).post('/quests/q-idle/complete');
    expect(res.status).toBe(409);
  });

  it('transitions active quest to complete and ends agent', async () => {
    insertActiveQuest(db, 'q-active', 'adv-1');
    insertAgent(db, 'agent-1', 'q-active', 'adv-1');
    db.prepare('UPDATE quests SET agent_id = ? WHERE id = ?').run('agent-1', 'q-active');

    const res = await request(app).post('/quests/q-active/complete').send({ summary: 'All done' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('complete');

    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get('agent-1') as { ended_at: string | null; exit_code: number | null };
    expect(agent.ended_at).not.toBeNull();
    expect(agent.exit_code).toBe(0);
  });
});

describe('POST /quests/:id/fail', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
    insertAdventurer(db, 'adv-1');
  });

  afterEach(() => { db.close(); });

  it('returns 404 for unknown quest', async () => {
    const res = await request(app).post('/quests/ghost/fail').send({ summary: 'Failed' });
    expect(res.status).toBe(404);
  });

  it('returns 409 when quest is not active', async () => {
    db.prepare(
      `INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json, status)
       VALUES (?, ?, ?, ?, ?, 'idle')`,
    ).run('q-idle', GOOD_QUEST_PROPS.title, GOOD_QUEST_PROPS.description,
      GOOD_QUEST_PROPS.acceptance_criteria_json, GOOD_QUEST_PROPS.edge_cases_json);
    const res = await request(app).post('/quests/q-idle/fail').send({ summary: 'Failed' });
    expect(res.status).toBe(409);
  });

  it('returns 400 without summary', async () => {
    insertActiveQuest(db, 'q-active', 'adv-1');
    const res = await request(app).post('/quests/q-active/fail').send({});
    expect(res.status).toBe(400);
  });

  it('transitions active quest to failed with failure summary', async () => {
    insertActiveQuest(db, 'q-fail', 'adv-1');
    insertAgent(db, 'agent-fail', 'q-fail', 'adv-1');
    db.prepare('UPDATE quests SET agent_id = ? WHERE id = ?').run('agent-fail', 'q-fail');

    const res = await request(app)
      .post('/quests/q-fail/fail')
      .send({ summary: 'Quest objective not met', recommendation: 'repost_with_clarification' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('failed');
    expect(res.body.failureSummary).toMatchObject({
      reason: 'Quest objective not met',
      recommendation: 'repost_with_clarification',
    });

    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get('agent-fail') as { ended_at: string | null; exit_code: number | null };
    expect(agent.ended_at).not.toBeNull();
    expect(agent.exit_code).toBe(1);
  });

  it('does not overwrite existing failure_summary when quest is already failed (race regression)', async () => {
    db.prepare(
      `INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json, status, failure_summary_json)
       VALUES (?, ?, ?, ?, ?, 'failed', ?)`,
    ).run(
      'q-race-fail',
      GOOD_QUEST_PROPS.title,
      GOOD_QUEST_PROPS.description,
      GOOD_QUEST_PROPS.acceptance_criteria_json,
      GOOD_QUEST_PROPS.edge_cases_json,
      JSON.stringify({ reason: 'User cancelled', recommendation: 'retire' }),
    );

    const res = await request(app)
      .post('/quests/q-race-fail/fail')
      .send({ summary: 'Runner also failed', recommendation: 'repost_with_clarification' });
    expect(res.status).toBe(409);

    const row = db.prepare('SELECT failure_summary_json FROM quests WHERE id = ?').get('q-race-fail') as {
      failure_summary_json: string;
    };
    const summary = JSON.parse(row.failure_summary_json) as { recommendation: string };
    expect(summary.recommendation).toBe('retire');
  });
});

describe('POST /quests/:id/cancel', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
    insertAdventurer(db, 'adv-1');
  });

  afterEach(() => { db.close(); });

  it('returns 404 for unknown quest', async () => {
    const res = await request(app).post('/quests/ghost/cancel');
    expect(res.status).toBe(404);
  });

  it('returns 409 when quest is not active', async () => {
    db.prepare(
      `INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json, status)
       VALUES (?, ?, ?, ?, ?, 'idle')`,
    ).run('q-idle', GOOD_QUEST_PROPS.title, GOOD_QUEST_PROPS.description,
      GOOD_QUEST_PROPS.acceptance_criteria_json, GOOD_QUEST_PROPS.edge_cases_json);
    const res = await request(app).post('/quests/q-idle/cancel');
    expect(res.status).toBe(409);
  });

  it('cancels active quest with retire recommendation', async () => {
    insertActiveQuest(db, 'q-cancel', 'adv-1');
    insertAgent(db, 'agent-cancel', 'q-cancel', 'adv-1');
    db.prepare('UPDATE quests SET agent_id = ? WHERE id = ?').run('agent-cancel', 'q-cancel');

    const res = await request(app).post('/quests/q-cancel/cancel');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('failed');
    expect(res.body.failureSummary).toMatchObject({ recommendation: 'retire' });

    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get('agent-cancel') as { ended_at: string | null };
    expect(agent.ended_at).not.toBeNull();
  });
});

describe('GET /quests/active', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
    insertAdventurer(db, 'adv-1');
  });

  afterEach(() => { db.close(); });

  it('returns empty array when no active quests', async () => {
    const res = await request(app).get('/quests/active');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns active quests with agent joined', async () => {
    insertActiveQuest(db, 'q-running', 'adv-1');
    insertAgent(db, 'agent-running', 'q-running', 'adv-1');
    db.prepare('UPDATE quests SET agent_id = ? WHERE id = ?').run('agent-running', 'q-running');

    const res = await request(app).get('/quests/active');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('q-running');
    expect(res.body[0].status).toBe('active');
    expect(res.body[0].agent).toMatchObject({ id: 'agent-running' });
  });

  it('does not return idle or complete quests', async () => {
    db.prepare(
      `INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('q-idle', GOOD_QUEST_PROPS.title, GOOD_QUEST_PROPS.description,
      GOOD_QUEST_PROPS.acceptance_criteria_json, GOOD_QUEST_PROPS.edge_cases_json, 'idle');
    db.prepare(
      `INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('q-done', GOOD_QUEST_PROPS.title, GOOD_QUEST_PROPS.description,
      GOOD_QUEST_PROPS.acceptance_criteria_json, GOOD_QUEST_PROPS.edge_cases_json, 'complete');
    insertActiveQuest(db, 'q-active', 'adv-1');

    const res = await request(app).get('/quests/active');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('q-active');
  });
});

describe('POST /quests/:id/dispatch — guard re-dispatch', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
    insertAdventurer(db, 'adv-1');
  });

  afterEach(() => { db.close(); });

  it('returns 409 when dispatching a complete quest', async () => {
    db.prepare(
      `INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json, status)
       VALUES (?, ?, ?, ?, ?, 'complete')`,
    ).run('q-done', GOOD_QUEST_PROPS.title, GOOD_QUEST_PROPS.description,
      GOOD_QUEST_PROPS.acceptance_criteria_json, GOOD_QUEST_PROPS.edge_cases_json);
    const res = await request(app).post('/quests/q-done/dispatch');
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already dispatched/i);
  });

  it('returns 409 when dispatching a failed quest', async () => {
    db.prepare(
      `INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json, status)
       VALUES (?, ?, ?, ?, ?, 'failed')`,
    ).run('q-failed', GOOD_QUEST_PROPS.title, GOOD_QUEST_PROPS.description,
      GOOD_QUEST_PROPS.acceptance_criteria_json, GOOD_QUEST_PROPS.edge_cases_json);
    const res = await request(app).post('/quests/q-failed/dispatch');
    expect(res.status).toBe(409);
  });
});
