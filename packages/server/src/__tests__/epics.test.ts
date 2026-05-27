import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import { openDb } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { createEpicsRouter } from '../routes/epics';
import { errorHandler } from '../middleware/errors';

function makeApp() {
  const db = openDb(':memory:');
  runMigrations(db);
  const app = express();
  app.use(express.json());
  app.use('/epics', createEpicsRouter(db));
  app.use(errorHandler);
  return { app, db };
}

describe('GET /epics', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
  });

  afterEach(() => {
    db.close();
  });

  it('returns empty array when no epics', async () => {
    const res = await request(app).get('/epics');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns list of epics', async () => {
    db.prepare('INSERT INTO epics (id, title, goal) VALUES (?, ?, ?)').run(
      'epic-1', 'Slay the Lich', 'Defeat the undead king',
    );
    const res = await request(app).get('/epics');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Slay the Lich');
    expect(res.body[0].createdAt).toBeTruthy();
  });
});

describe('POST /epics', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
  });

  afterEach(() => {
    db.close();
  });

  it('creates an epic and returns 201', async () => {
    const res = await request(app).post('/epics').send({
      title: 'Conquer the Dark Tower',
      goal: 'Reach the top floor',
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.title).toBe('Conquer the Dark Tower');
    expect(res.body.goal).toBe('Reach the top floor');
    expect(res.body.createdAt).toBeTruthy();
  });

  it('rejects missing title with 400', async () => {
    const res = await request(app).post('/epics').send({ goal: 'Some goal' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
    expect(res.body.field).toBeTruthy();
  });

  it('rejects missing goal with 400', async () => {
    const res = await request(app).post('/epics').send({ title: 'Some title' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('rejects empty title with 400', async () => {
    const res = await request(app).post('/epics').send({ title: '', goal: 'goal' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });
});

describe('GET /epics/:id', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
  });

  afterEach(() => {
    db.close();
  });

  it('returns epic by id', async () => {
    db.prepare('INSERT INTO epics (id, title, goal) VALUES (?, ?, ?)').run(
      'epic-get', 'Find the Relic', 'Retrieve the ancient artifact',
    );
    const res = await request(app).get('/epics/epic-get');
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Find the Relic');
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/epics/ghost');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });
});

describe('PATCH /epics/:id', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
    db.prepare('INSERT INTO epics (id, title, goal) VALUES (?, ?, ?)').run(
      'epic-patch', 'Old Title', 'Old Goal',
    );
  });

  afterEach(() => {
    db.close();
  });

  it('patches title and returns 200', async () => {
    const res = await request(app).patch('/epics/epic-patch').send({ title: 'New Title' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New Title');
    expect(res.body.goal).toBe('Old Goal');
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).patch('/epics/ghost').send({ title: 'Phantom' });
    expect(res.status).toBe(404);
  });

  it('rejects empty title', async () => {
    const res = await request(app).patch('/epics/epic-patch').send({ title: '' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /epics/:id', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
    db.prepare('INSERT INTO epics (id, title, goal) VALUES (?, ?, ?)').run(
      'epic-del', 'Doomed Epic', 'Doomed Goal',
    );
  });

  afterEach(() => {
    db.close();
  });

  it('deletes an epic and returns 204', async () => {
    const res = await request(app).delete('/epics/epic-del');
    expect(res.status).toBe(204);
    const check = db.prepare('SELECT id FROM epics WHERE id = ?').get('epic-del');
    expect(check).toBeUndefined();
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).delete('/epics/ghost');
    expect(res.status).toBe(404);
  });
});
