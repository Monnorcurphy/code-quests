import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type Database from 'better-sqlite3';
import { openDb } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { createQuestActionsRouter } from '../routes/quest-actions';
import { errorHandler } from '../middleware/errors';

function makeApp() {
  const db = openDb(':memory:');
  runMigrations(db);
  const app = express();
  app.use(express.json());
  app.use('/quests', createQuestActionsRouter(db));
  app.use(errorHandler);
  return { app, db };
}

function insertQuest(
  db: Database.Database,
  opts: {
    id?: string;
    title?: string;
    status?: string;
    adventurerId?: string | null;
    failureSummaryJson?: string | null;
    equipmentJson?: string;
    acceptanceCriteriaJson?: string;
    edgeCasesJson?: string;
    epicId?: string | null;
    userFeedbackJson?: string | null;
  } = {},
) {
  const {
    id = 'quest-1',
    title = 'Slay the Dragon',
    status = 'returned_to_town',
    adventurerId = null,
    failureSummaryJson = null,
    equipmentJson = '{"skillIds":[],"toolIds":[],"mcpServerIds":[]}',
    acceptanceCriteriaJson = '["AC 1"]',
    edgeCasesJson = '["edge 1"]',
    epicId = null,
    userFeedbackJson = null,
  } = opts;
  db.prepare(
    `INSERT INTO quests
       (id, epic_id, title, status, adventurer_id, failure_summary_json,
        equipment_json, acceptance_criteria_json, edge_cases_json, user_feedback_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    epicId,
    title,
    status,
    adventurerId,
    failureSummaryJson,
    equipmentJson,
    acceptanceCriteriaJson,
    edgeCasesJson,
    userFeedbackJson,
  );
  return id;
}

describe('POST /quests/:questId/actions/repost', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
  });

  afterEach(() => {
    db.close();
  });

  it('creates a new quest seeded from the returned quest', async () => {
    insertQuest(db, { id: 'q-src' });

    const res = await request(app)
      .post('/quests/q-src/actions/repost')
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.id).not.toBe('q-src');
    expect(res.body.title).toBe('Slay the Dragon');
    expect(res.body.status).toBe('idle');
    expect(res.body.adventurerId).toBeNull();
  });

  it('applies adjustments to the new quest', async () => {
    insertQuest(db, { id: 'q-src', acceptanceCriteriaJson: '["Old AC"]' });

    const res = await request(app)
      .post('/quests/q-src/actions/repost')
      .send({
        adjustments: { acceptanceCriteria: ['New AC 1', 'New AC 2'] },
      });

    expect(res.status).toBe(201);
    expect(res.body.acceptanceCriteria).toEqual(['New AC 1', 'New AC 2']);
    expect(res.body.edgeCases).toEqual(['edge 1']); // unchanged
  });

  it('returns 409 when source quest is not returned_to_town', async () => {
    insertQuest(db, { id: 'q-active', status: 'active' });

    const res = await request(app)
      .post('/quests/q-active/actions/repost')
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('returned_to_town');
    expect(res.body.field).toBe('status');
  });

  it('returns 404 for unknown quest', async () => {
    const res = await request(app).post('/quests/nonexistent/actions/repost').send({});
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Quest not found');
  });

  it('inherits epic_id from source quest', async () => {
    db.prepare('INSERT INTO epics (id, title, goal) VALUES (?, ?, ?)').run(
      'epic-1',
      'Grand Epic',
      'Win',
    );
    insertQuest(db, { id: 'q-src', epicId: 'epic-1' });

    const res = await request(app).post('/quests/q-src/actions/repost').send({});
    expect(res.status).toBe(201);
    expect(res.body.epicId).toBe('epic-1');
  });

  it('uses adjusted equipment if provided', async () => {
    insertQuest(db, { id: 'q-src' });
    const newEquipment = { skillIds: ['sk-1'], toolIds: [], mcpServerIds: [] };

    const res = await request(app)
      .post('/quests/q-src/actions/repost')
      .send({ adjustments: { equipment: newEquipment } });

    expect(res.status).toBe(201);
    expect(res.body.equipment.skillIds).toEqual(['sk-1']);
  });
});

describe('POST /quests/:questId/actions/retire', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
  });

  afterEach(() => {
    db.close();
  });

  it('retires a returned_to_town quest', async () => {
    insertQuest(db, { id: 'q-1' });

    const res = await request(app).post('/quests/q-1/actions/retire').send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('retired');
  });

  it('is idempotent — second call returns 200 with retired status', async () => {
    insertQuest(db, { id: 'q-1' });

    const res1 = await request(app).post('/quests/q-1/actions/retire').send({});
    expect(res1.status).toBe(200);
    expect(res1.body.status).toBe('retired');

    const res2 = await request(app).post('/quests/q-1/actions/retire').send({});
    expect(res2.status).toBe(200);
    expect(res2.body.status).toBe('retired');
  });

  it('returns 409 when quest is active', async () => {
    insertQuest(db, { id: 'q-1', status: 'active' });

    const res = await request(app).post('/quests/q-1/actions/retire').send({});
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('returned_to_town');
  });

  it('returns 409 when quest is idle', async () => {
    insertQuest(db, { id: 'q-1', status: 'idle' });

    const res = await request(app).post('/quests/q-1/actions/retire').send({});
    expect(res.status).toBe(409);
  });

  it('returns 404 for unknown quest', async () => {
    const res = await request(app).post('/quests/nonexistent/actions/retire').send({});
    expect(res.status).toBe(404);
  });
});

describe('POST /quests/:questId/actions/split', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
  });

  afterEach(() => {
    db.close();
  });

  const validChildren = [
    { title: 'Child A', description: 'First part', acceptanceCriteria: ['A done'] },
    { title: 'Child B', description: 'Second part', acceptanceCriteria: ['B done'] },
  ];

  it('creates child quests and updates source failure_summary_json', async () => {
    insertQuest(db, { id: 'q-src' });

    const res = await request(app)
      .post('/quests/q-src/actions/split')
      .send({ children: validChildren });

    expect(res.status).toBe(201);
    expect(res.body.childQuests).toHaveLength(2);
    expect(res.body.childQuests[0].title).toBe('Child A');
    expect(res.body.childQuests[0].status).toBe('idle');
    expect(res.body.childQuests[1].title).toBe('Child B');
    expect(res.body.originalQuest.failureSummary.splitIntoQuestIds).toHaveLength(2);
  });

  it('creates an epic when source has no epic', async () => {
    insertQuest(db, { id: 'q-src', epicId: null });

    const res = await request(app)
      .post('/quests/q-src/actions/split')
      .send({ children: validChildren });

    expect(res.status).toBe(201);
    expect(res.body.childQuests[0].epicId).not.toBeNull();
    expect(res.body.childQuests[1].epicId).toBe(res.body.childQuests[0].epicId);
  });

  it('uses existing epic when source has one', async () => {
    db.prepare('INSERT INTO epics (id, title, goal) VALUES (?, ?, ?)').run(
      'epic-1',
      'Grand Epic',
      'Win',
    );
    insertQuest(db, { id: 'q-src', epicId: 'epic-1' });

    const res = await request(app)
      .post('/quests/q-src/actions/split')
      .send({ children: validChildren });

    expect(res.status).toBe(201);
    expect(res.body.childQuests[0].epicId).toBe('epic-1');
  });

  it('returns 400 when fewer than 2 children', async () => {
    insertQuest(db, { id: 'q-src' });

    const res = await request(app)
      .post('/quests/q-src/actions/split')
      .send({ children: [{ title: 'Only child', acceptanceCriteria: ['done'] }] });

    expect(res.status).toBe(400);
  });

  it('returns 400 when children array is empty', async () => {
    insertQuest(db, { id: 'q-src' });

    const res = await request(app)
      .post('/quests/q-src/actions/split')
      .send({ children: [] });

    expect(res.status).toBe(400);
  });

  it('returns 409 when quest is not returned_to_town', async () => {
    insertQuest(db, { id: 'q-src', status: 'idle' });

    const res = await request(app)
      .post('/quests/q-src/actions/split')
      .send({ children: validChildren });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('returned_to_town');
  });

  it('returns 404 for unknown quest', async () => {
    const res = await request(app)
      .post('/quests/nonexistent/actions/split')
      .send({ children: validChildren });
    expect(res.status).toBe(404);
  });

  it('preserves original failure summary fields while adding splitIntoQuestIds', async () => {
    const summary = { recommendation: 'break_into_smaller', reason: 'Too big', retries: 1 };
    insertQuest(db, { id: 'q-src', failureSummaryJson: JSON.stringify(summary) });

    const res = await request(app)
      .post('/quests/q-src/actions/split')
      .send({ children: validChildren });

    expect(res.status).toBe(201);
    const updatedSummary = res.body.originalQuest.failureSummary;
    expect(updatedSummary.recommendation).toBe('break_into_smaller');
    expect(updatedSummary.reason).toBe('Too big');
    expect(updatedSummary.splitIntoQuestIds).toHaveLength(2);
  });

  it('child quests inherit context from source', async () => {
    db.prepare(
      `INSERT INTO quests (id, title, status, context)
       VALUES (?, ?, ?, ?)`,
    ).run('q-src', 'Quest', 'returned_to_town', 'Some project context');

    const res = await request(app)
      .post('/quests/q-src/actions/split')
      .send({ children: validChildren });

    expect(res.status).toBe(201);
    expect(res.body.childQuests[0].context).toBe('Some project context');
  });
});

describe('POST /quests/:questId/actions/feedback', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
  });

  afterEach(() => {
    db.close();
  });

  it('appends feedback entry and returns it', async () => {
    insertQuest(db, { id: 'q-1' });

    const res = await request(app)
      .post('/quests/q-1/actions/feedback')
      .send({ text: 'ACs were too vague' });

    expect(res.status).toBe(200);
    expect(res.body.entry.text).toBe('ACs were too vague');
    expect(res.body.entry.createdAt).toBeTruthy();
    expect(res.body.feedbackCount).toBe(1);
  });

  it('appends — never overwrites — existing feedback', async () => {
    const existing = [{ text: 'First note', createdAt: '2025-01-01T00:00:00.000Z' }];
    insertQuest(db, { id: 'q-1', userFeedbackJson: JSON.stringify(existing) });

    const res = await request(app)
      .post('/quests/q-1/actions/feedback')
      .send({ text: 'Second note' });

    expect(res.status).toBe(200);
    expect(res.body.feedbackCount).toBe(2);

    const row = db
      .prepare('SELECT user_feedback_json FROM quests WHERE id = ?')
      .get('q-1') as { user_feedback_json: string };
    const stored = JSON.parse(row.user_feedback_json) as Array<{ text: string }>;
    expect(stored).toHaveLength(2);
    expect(stored[0].text).toBe('First note');
    expect(stored[1].text).toBe('Second note');
  });

  it('returns 400 for empty text', async () => {
    insertQuest(db, { id: 'q-1' });

    const res = await request(app)
      .post('/quests/q-1/actions/feedback')
      .send({ text: '' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for text exceeding 2000 chars', async () => {
    insertQuest(db, { id: 'q-1' });

    const res = await request(app)
      .post('/quests/q-1/actions/feedback')
      .send({ text: 'x'.repeat(2001) });

    expect(res.status).toBe(400);
  });

  it('returns 400 for missing text field', async () => {
    insertQuest(db, { id: 'q-1' });

    const res = await request(app)
      .post('/quests/q-1/actions/feedback')
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown quest', async () => {
    const res = await request(app)
      .post('/quests/nonexistent/actions/feedback')
      .send({ text: 'hello' });

    expect(res.status).toBe(404);
  });

  it('accepts text at max length (2000 chars)', async () => {
    insertQuest(db, { id: 'q-1' });

    const res = await request(app)
      .post('/quests/q-1/actions/feedback')
      .send({ text: 'x'.repeat(2000) });

    expect(res.status).toBe(200);
  });
});
