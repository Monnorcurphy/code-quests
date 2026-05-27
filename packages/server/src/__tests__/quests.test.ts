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

describe('GET /quests', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
  });

  afterEach(() => {
    db.close();
  });

  it('returns empty array when no quests', async () => {
    const res = await request(app).get('/quests');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns list of quests', async () => {
    db.prepare('INSERT INTO quests (id, title) VALUES (?, ?)').run('quest-1', 'Slay the Dragon');
    const res = await request(app).get('/quests');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Slay the Dragon');
    expect(res.body[0].status).toBe('idle');
  });
});

describe('POST /quests', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
  });

  afterEach(() => {
    db.close();
  });

  it('creates a quest with defaults and returns 201', async () => {
    const res = await request(app).post('/quests').send({ title: 'Find the Artifact' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.title).toBe('Find the Artifact');
    expect(res.body.status).toBe('idle');
    expect(res.body.acceptanceCriteria).toEqual([]);
    expect(res.body.edgeCases).toEqual([]);
    expect(res.body.epicId).toBeNull();
    expect(res.body.adventurerId).toBeNull();
  });

  it('creates a quest with full payload', async () => {
    db.prepare('INSERT INTO adventurers (id, name, class, model_id) VALUES (?, ?, ?, ?)').run(
      'adv-q', 'Hero', 'champion', 'claude-opus-4-7',
    );
    db.prepare('INSERT INTO epics (id, title, goal) VALUES (?, ?, ?)').run(
      'epic-q', 'Grand Epic', 'Win',
    );
    const res = await request(app).post('/quests').send({
      title: 'Clear the Dungeon',
      epicId: 'epic-q',
      adventurerId: 'adv-q',
      acceptanceCriteria: ['All monsters defeated', 'Treasure collected'],
      status: 'idle',
    });
    expect(res.status).toBe(201);
    expect(res.body.epicId).toBe('epic-q');
    expect(res.body.adventurerId).toBe('adv-q');
    expect(res.body.acceptanceCriteria).toEqual(['All monsters defeated', 'Treasure collected']);
  });

  it('rejects missing title with 400', async () => {
    const res = await request(app).post('/quests').send({ description: 'No title' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
    expect(res.body.field).toBe('title');
  });

  it('rejects invalid status with 400', async () => {
    const res = await request(app).post('/quests').send({
      title: 'Bad Status Quest',
      status: 'flying',
    });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('status');
  });

  it('rejects POST /quests with an unknown epicId', async () => {
    const res = await request(app).post('/quests').send({
      title: 'Phantom Epic Quest',
      epicId: 'nonexistent-epic',
    });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('epicId');
  });

  it('rejects POST /quests with an unknown adventurerId', async () => {
    const res = await request(app).post('/quests').send({
      title: 'Phantom Adventurer Quest',
      adventurerId: 'nonexistent-adv',
    });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('adventurerId');
  });
});

describe('GET /quests/:id', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
  });

  afterEach(() => {
    db.close();
  });

  it('returns quest by id', async () => {
    db.prepare('INSERT INTO quests (id, title) VALUES (?, ?)').run('quest-get', 'Guard the Gate');
    const res = await request(app).get('/quests/quest-get');
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Guard the Gate');
    expect(res.body.acLockedAt).toBeNull();
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/quests/ghost');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });
});

describe('PATCH /quests/:id', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
    db.prepare('INSERT INTO quests (id, title) VALUES (?, ?)').run('quest-patch', 'Patrol the Border');
  });

  afterEach(() => {
    db.close();
  });

  it('patches allowed fields and returns 200', async () => {
    const res = await request(app).patch('/quests/quest-patch').send({
      title: 'Defend the Border',
      status: 'active',
    });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Defend the Border');
    expect(res.body.status).toBe('active');
  });

  it('allows patching AC when ac_locked_at is null', async () => {
    const res = await request(app).patch('/quests/quest-patch').send({
      acceptanceCriteria: ['Enemies repelled'],
    });
    expect(res.status).toBe(200);
    expect(res.body.acceptanceCriteria).toEqual(['Enemies repelled']);
  });

  it('rejects AC mutation when quest is locked (ac_locked_at set)', async () => {
    db.prepare(`UPDATE quests SET ac_locked_at = ? WHERE id = ?`).run(
      new Date().toISOString(), 'quest-patch',
    );
    const res = await request(app).patch('/quests/quest-patch').send({
      acceptanceCriteria: ['New criteria'],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/locked/i);
    expect(res.body.field).toBe('acceptanceCriteria');
  });

  it('allows non-AC patches when quest is locked', async () => {
    db.prepare(`UPDATE quests SET ac_locked_at = ? WHERE id = ?`).run(
      new Date().toISOString(), 'quest-patch',
    );
    const res = await request(app).patch('/quests/quest-patch').send({ title: 'New Title' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New Title');
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).patch('/quests/ghost').send({ title: 'Phantom' });
    expect(res.status).toBe(404);
  });

  it('rejects PATCH /quests/:id with an unknown epicId', async () => {
    const res = await request(app).patch('/quests/quest-patch').send({ epicId: 'ghost-epic' });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('epicId');
  });

  it('rejects PATCH /quests/:id with an unknown adventurerId', async () => {
    const res = await request(app).patch('/quests/quest-patch').send({ adventurerId: 'ghost-adv' });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('adventurerId');
  });

  it('rejects invalid status in patch', async () => {
    const res = await request(app).patch('/quests/quest-patch').send({ status: 'unknown' });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('status');
  });
});

describe('specAudit round-trip', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
    db.prepare('INSERT INTO quests (id, title) VALUES (?, ?)').run('quest-audit', 'Audit Quest');
  });

  afterEach(() => {
    db.close();
  });

  const validAudit = {
    runAt: '2026-05-27T10:00:00.000Z',
    gaps: [
      { building: 'oracle', reason: 'Acceptance criteria missing', severity: 'block' },
    ],
    bypassed: false,
  };

  it('new quest defaults specAudit to null', async () => {
    const res = await request(app).post('/quests').send({ title: 'No Audit Quest' });
    expect(res.status).toBe(201);
    expect(res.body.specAudit).toBeNull();
  });

  it('GET /quests/:id returns specAudit as null when not set', async () => {
    const res = await request(app).get('/quests/quest-audit');
    expect(res.status).toBe(200);
    expect(res.body.specAudit).toBeNull();
  });

  it('PATCH sets specAudit and GET returns it', async () => {
    const patchRes = await request(app)
      .patch('/quests/quest-audit')
      .send({ specAudit: validAudit });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.specAudit).toBeDefined();
    expect(patchRes.body.specAudit.runAt).toBe(validAudit.runAt);
    expect(patchRes.body.specAudit.gaps).toHaveLength(1);
    expect(patchRes.body.specAudit.gaps[0].building).toBe('oracle');
    expect(patchRes.body.specAudit.bypassed).toBe(false);

    const getRes = await request(app).get('/quests/quest-audit');
    expect(getRes.status).toBe(200);
    expect(getRes.body.specAudit.runAt).toBe(validAudit.runAt);
    expect(getRes.body.specAudit.gaps[0].severity).toBe('block');
  });

  it('PATCH with null specAudit clears the field', async () => {
    db.prepare(
      "UPDATE quests SET spec_audit_json = ? WHERE id = ?",
    ).run(JSON.stringify(validAudit), 'quest-audit');

    const patchRes = await request(app)
      .patch('/quests/quest-audit')
      .send({ specAudit: null });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.specAudit).toBeNull();
  });

  it('rejects PATCH with invalid specAudit (unknown building)', async () => {
    const res = await request(app)
      .patch('/quests/quest-audit')
      .send({
        specAudit: { runAt: '2026-01-01T00:00:00.000Z', gaps: [{ building: 'dungeon', reason: 'bad', severity: 'warn' }], bypassed: false },
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('rejects PATCH with specAudit missing runAt', async () => {
    const res = await request(app)
      .patch('/quests/quest-audit')
      .send({ specAudit: { gaps: [], bypassed: false } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('POST with specAudit persists it', async () => {
    const res = await request(app).post('/quests').send({
      title: 'Audited Quest',
      specAudit: validAudit,
    });
    expect(res.status).toBe(201);
    expect(res.body.specAudit.runAt).toBe(validAudit.runAt);
    expect(res.body.specAudit.gaps).toHaveLength(1);
  });
});

describe('POST /quests/:id/audit', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
    db.prepare(
      "INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json) VALUES (?, ?, ?, ?, ?)",
    ).run(
      'quest-for-audit',
      'Audit Me',
      'A sufficiently long description to pass deterministic rules minimum length',
      JSON.stringify(['Users can log in', 'Invalid credentials rejected']),
      JSON.stringify(['Expired token', 'Network outage']),
    );
  });

  afterEach(() => {
    db.close();
  });

  it('returns 404 for unknown quest id', async () => {
    const res = await request(app).post('/quests/ghost/audit');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  it('runs audit and returns a valid SpecAudit object', async () => {
    const res = await request(app).post('/quests/quest-for-audit/audit');
    expect(res.status).toBe(200);
    expect(res.body.runAt).toBeTruthy();
    expect(Array.isArray(res.body.gaps)).toBe(true);
    expect(typeof res.body.bypassed).toBe('boolean');
  });

  it('persists audit result — subsequent GET returns it', async () => {
    await request(app).post('/quests/quest-for-audit/audit');
    const getRes = await request(app).get('/quests/quest-for-audit');
    expect(getRes.status).toBe(200);
    expect(getRes.body.specAudit).not.toBeNull();
    expect(getRes.body.specAudit.runAt).toBeTruthy();
  });

  it('quest with no ACs gets an oracle/block gap', async () => {
    db.prepare('INSERT INTO quests (id, title, description) VALUES (?, ?, ?)').run(
      'bare-quest',
      'Bare Quest',
      'A sufficiently long description for testing the audit oracle gap detection',
    );
    const res = await request(app).post('/quests/bare-quest/audit');
    expect(res.status).toBe(200);
    const oracleGap = (res.body.gaps as Array<{ building: string; severity: string }>).find(
      (g) => g.building === 'oracle',
    );
    expect(oracleGap).toBeDefined();
    expect(oracleGap?.severity).toBe('block');
  });
});

describe('DELETE /quests/:id', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
    db.prepare('INSERT INTO quests (id, title) VALUES (?, ?)').run('quest-del', 'Doomed Quest');
  });

  afterEach(() => {
    db.close();
  });

  it('deletes a quest and returns 204', async () => {
    const res = await request(app).delete('/quests/quest-del');
    expect(res.status).toBe(204);
    const check = db.prepare('SELECT id FROM quests WHERE id = ?').get('quest-del');
    expect(check).toBeUndefined();
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).delete('/quests/ghost');
    expect(res.status).toBe(404);
  });
});
