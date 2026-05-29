import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import { openDb } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { createHallOfReturnsRouter } from '../routes/hall-of-returns';
import { errorHandler } from '../middleware/errors';

function makeApp() {
  const db = openDb(':memory:');
  runMigrations(db);
  const app = express();
  app.use(express.json());
  app.use('/hall-of-returns', createHallOfReturnsRouter(db));
  app.use(errorHandler);
  return { app, db };
}

function insertAdventurer(
  db: Database.Database,
  opts: { id?: string; name?: string; cls?: string } = {},
) {
  const { id = 'adv-1', name = 'Aria', cls = 'champion' } = opts;
  db.prepare(
    'INSERT INTO adventurers (id, name, class, model_id) VALUES (?, ?, ?, ?)',
  ).run(id, name, cls, 'claude-opus-4-7');
  return id;
}

function insertQuest(
  db: Database.Database,
  opts: {
    id?: string;
    title?: string;
    status?: string;
    adventurerId?: string | null;
    failureSummaryJson?: string | null;
    updatedAt?: string;
  } = {},
) {
  const {
    id = 'quest-1',
    title = 'Slay the Dragon',
    status = 'returned_to_town',
    adventurerId = null,
    failureSummaryJson = null,
    updatedAt = new Date().toISOString(),
  } = opts;
  db.prepare(
    `INSERT INTO quests (id, title, status, adventurer_id, failure_summary_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, title, status, adventurerId, failureSummaryJson, updatedAt);
  return id;
}

describe('GET /hall-of-returns/quests', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
  });

  afterEach(() => {
    db.close();
  });

  it('returns empty list when no quests', async () => {
    const res = await request(app).get('/hall-of-returns/quests');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.nextCursor).toBeNull();
  });

  it('returns only returned_to_town quests by default', async () => {
    insertQuest(db, { id: 'q-1', status: 'returned_to_town' });
    insertQuest(db, { id: 'q-2', status: 'complete' });
    insertQuest(db, { id: 'q-3', status: 'idle' });

    const res = await request(app).get('/hall-of-returns/quests');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe('q-1');
  });

  it('returns completed quests when status=completed', async () => {
    insertQuest(db, { id: 'q-1', status: 'returned_to_town' });
    insertQuest(db, { id: 'q-2', status: 'complete' });

    const res = await request(app).get('/hall-of-returns/quests?status=complete');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe('q-2');
  });

  it('returns 400 for invalid status', async () => {
    const res = await request(app).get('/hall-of-returns/quests?status=active');
    expect(res.status).toBe(400);
  });

  it('includes adventurer data when quest has one assigned', async () => {
    const advId = insertAdventurer(db);
    insertQuest(db, { id: 'q-1', adventurerId: advId });

    const res = await request(app).get('/hall-of-returns/quests');
    expect(res.status).toBe(200);
    expect(res.body.items[0].adventurer).toMatchObject({ id: advId, name: 'Aria', class: 'champion' });
  });

  it('returns adventurer null when not assigned', async () => {
    insertQuest(db, { id: 'q-1' });
    const res = await request(app).get('/hall-of-returns/quests');
    expect(res.status).toBe(200);
    expect(res.body.items[0].adventurer).toBeNull();
  });

  it('includes failure summary in items', async () => {
    const summary = { recommendation: 'retire', reason: 'Too hard' };
    insertQuest(db, { id: 'q-1', failureSummaryJson: JSON.stringify(summary) });

    const res = await request(app).get('/hall-of-returns/quests');
    expect(res.status).toBe(200);
    expect(res.body.items[0].failureSummary.recommendation).toBe('retire');
  });

  it('paginates using limit', async () => {
    for (let i = 1; i <= 5; i++) {
      insertQuest(db, {
        id: `q-${i}`,
        updatedAt: new Date(1000 + i * 1000).toISOString(),
      });
    }

    const res = await request(app).get('/hall-of-returns/quests?limit=3');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(3);
    expect(res.body.nextCursor).not.toBeNull();
  });

  it('returns null nextCursor when no more pages', async () => {
    insertQuest(db, { id: 'q-1' });
    const res = await request(app).get('/hall-of-returns/quests?limit=10');
    expect(res.status).toBe(200);
    expect(res.body.nextCursor).toBeNull();
  });

  it('cursor-paginates correctly', async () => {
    const timestamps = [
      '2025-01-05T00:00:00.000Z',
      '2025-01-04T00:00:00.000Z',
      '2025-01-03T00:00:00.000Z',
      '2025-01-02T00:00:00.000Z',
      '2025-01-01T00:00:00.000Z',
    ];
    for (let i = 0; i < timestamps.length; i++) {
      insertQuest(db, { id: `q-${i}`, updatedAt: timestamps[i] });
    }

    const page1 = await request(app).get('/hall-of-returns/quests?limit=2');
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.items[0].id).toBe('q-0');
    const cursor = page1.body.nextCursor as string;

    const page2 = await request(app).get(
      `/hall-of-returns/quests?limit=2&cursor=${encodeURIComponent(cursor)}`,
    );
    expect(page2.body.items).toHaveLength(2);
    expect(page2.body.items[0].id).toBe('q-2');
  });

  it('orders by updated_at descending (newest first)', async () => {
    insertQuest(db, { id: 'old', updatedAt: '2025-01-01T00:00:00.000Z' });
    insertQuest(db, { id: 'new', updatedAt: '2025-06-01T00:00:00.000Z' });

    const res = await request(app).get('/hall-of-returns/quests');
    expect(res.status).toBe(200);
    expect(res.body.items[0].id).toBe('new');
    expect(res.body.items[1].id).toBe('old');
  });
});

describe('GET /hall-of-returns/quests/:questId/post-mortem', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
  });

  afterEach(() => {
    db.close();
  });

  it('returns 404 for unknown quest', async () => {
    const res = await request(app).get('/hall-of-returns/quests/nonexistent/post-mortem');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Quest not found');
  });

  it('returns quest with no adventurer, attempts, or encounters', async () => {
    insertQuest(db, { id: 'q-1', status: 'returned_to_town' });

    const res = await request(app).get('/hall-of-returns/quests/q-1/post-mortem');
    expect(res.status).toBe(200);
    expect(res.body.quest.id).toBe('q-1');
    expect(res.body.adventurer).toBeNull();
    expect(res.body.attempts).toEqual([]);
    expect(res.body.encounters).toEqual([]);
    expect(res.body.failureSummary).toBeNull();
  });

  it('includes adventurer when assigned', async () => {
    const advId = insertAdventurer(db, { name: 'Bram', cls: 'ranger' });
    insertQuest(db, { id: 'q-1', adventurerId: advId });

    const res = await request(app).get('/hall-of-returns/quests/q-1/post-mortem');
    expect(res.status).toBe(200);
    expect(res.body.adventurer).toMatchObject({
      id: advId,
      name: 'Bram',
      class: 'ranger',
    });
  });

  it('includes parsed failure summary', async () => {
    const summary = {
      recommendation: 'break_into_smaller',
      reason: 'Too complex',
      retries: 2,
    };
    insertQuest(db, {
      id: 'q-1',
      failureSummaryJson: JSON.stringify(summary),
    });

    const res = await request(app).get('/hall-of-returns/quests/q-1/post-mortem');
    expect(res.status).toBe(200);
    expect(res.body.failureSummary).toMatchObject({
      recommendation: 'break_into_smaller',
      retries: 2,
    });
  });

  it('includes agents as attempts', async () => {
    const advId = insertAdventurer(db);
    insertQuest(db, { id: 'q-1', adventurerId: advId });
    db.prepare(
      `INSERT INTO agents (id, adventurer_id, quest_id, started_at)
       VALUES (?, ?, ?, ?)`,
    ).run('agent-1', advId, 'q-1', new Date().toISOString());

    const res = await request(app).get('/hall-of-returns/quests/q-1/post-mortem');
    expect(res.status).toBe(200);
    expect(res.body.attempts).toHaveLength(1);
    expect(res.body.attempts[0].id).toBe('agent-1');
    expect(res.body.attempts[0].questId).toBe('q-1');
  });

  it('includes monster encounters', async () => {
    const advId = insertAdventurer(db);
    insertQuest(db, { id: 'q-1', adventurerId: advId });

    db.prepare(
      `INSERT INTO monsters (id, type_id, name, scope, calibrated_difficulty)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('monster-1', 'goblin_linter', 'Goblin Prime', 'project', 1);

    db.prepare(
      `INSERT INTO monster_encounters
         (id, monster_id, quest_id, appeared_at, combat_log_json, outcome, loot_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'enc-1',
      'monster-1',
      'q-1',
      new Date().toISOString(),
      '[]',
      'defeat',
      '[]',
    );

    const res = await request(app).get('/hall-of-returns/quests/q-1/post-mortem');
    expect(res.status).toBe(200);
    expect(res.body.encounters).toHaveLength(1);
    expect(res.body.encounters[0].id).toBe('enc-1');
    expect(res.body.encounters[0].outcome).toBe('defeat');
    expect(res.body.encounters[0].monsterName).toBe('Goblin Prime');
  });

  it('includes user feedback in quest', async () => {
    const feedback = [{ text: 'ACs too vague', createdAt: new Date().toISOString() }];
    db.prepare(
      `INSERT INTO quests (id, title, status, user_feedback_json) VALUES (?, ?, ?, ?)`,
    ).run('q-1', 'Test Quest', 'returned_to_town', JSON.stringify(feedback));

    const res = await request(app).get('/hall-of-returns/quests/q-1/post-mortem');
    expect(res.status).toBe(200);
    expect(res.body.quest.userFeedback).toHaveLength(1);
    expect(res.body.quest.userFeedback[0].text).toBe('ACs too vague');
  });

  it('returns empty userFeedback array when none recorded', async () => {
    insertQuest(db, { id: 'q-1' });
    const res = await request(app).get('/hall-of-returns/quests/q-1/post-mortem');
    expect(res.status).toBe(200);
    expect(res.body.quest.userFeedback).toEqual([]);
  });
});
