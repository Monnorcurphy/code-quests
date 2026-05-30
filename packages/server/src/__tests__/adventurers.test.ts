import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import { openDb } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { createAdventurersRouter } from '../routes/adventurers';
import { errorHandler } from '../middleware/errors';

function makeApp() {
  const db = openDb(':memory:');
  runMigrations(db);
  const app = express();
  app.use(express.json());
  app.use('/adventurers', createAdventurersRouter(db));
  app.use(errorHandler);
  return { app, db };
}

describe('GET /adventurers', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
  });

  afterEach(() => {
    db.close();
  });

  it('returns empty array when no adventurers', async () => {
    const res = await request(app).get('/adventurers');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns list of adventurers', async () => {
    db.prepare('INSERT INTO adventurers (id, name, class, model_id) VALUES (?, ?, ?, ?)').run(
      'adv-1', 'Aria', 'ranger', 'claude-opus-4-7',
    );
    const res = await request(app).get('/adventurers');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Aria');
    expect(res.body[0].modelId).toBe('claude-opus-4-7');
  });
});

describe('POST /adventurers', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
  });

  afterEach(() => {
    db.close();
  });

  it('creates an adventurer and returns 201', async () => {
    const res = await request(app).post('/adventurers').send({
      name: 'Brennan',
      class: 'champion',
      modelId: 'claude-opus-4-7',
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.name).toBe('Brennan');
    expect(res.body.class).toBe('champion');
    expect(res.body.modelId).toBe('claude-opus-4-7');
    expect(res.body.stats).toEqual({});
    expect(res.body.specializations).toEqual([]);
    expect(res.body.scars).toEqual([]);
  });

  it('rejects missing required fields with 400', async () => {
    const res = await request(app).post('/adventurers').send({ name: 'Brennan' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
    expect(res.body.field).toBeTruthy();
  });

  it('rejects invalid class with 400', async () => {
    const res = await request(app).post('/adventurers').send({
      name: 'Mage',
      class: 'wizard',
      modelId: 'claude-opus-4-7',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
    expect(res.body.field).toBe('class');
  });

  it('rejects empty name with 400', async () => {
    const res = await request(app).post('/adventurers').send({
      name: '',
      class: 'scout',
      modelId: 'claude-opus-4-7',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });
});

describe('GET /adventurers/:id', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
  });

  afterEach(() => {
    db.close();
  });

  it('returns adventurer by id', async () => {
    db.prepare('INSERT INTO adventurers (id, name, class, model_id) VALUES (?, ?, ?, ?)').run(
      'adv-get', 'Cora', 'rogue', 'claude-sonnet-4-6',
    );
    const res = await request(app).get('/adventurers/adv-get');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Cora');
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/adventurers/ghost');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });
});

describe('PATCH /adventurers/:id', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
    db.prepare('INSERT INTO adventurers (id, name, class, model_id) VALUES (?, ?, ?, ?)').run(
      'adv-patch', 'Drake', 'apprentice', 'claude-haiku-4-5',
    );
  });

  afterEach(() => {
    db.close();
  });

  it('patches allowed fields and returns 200', async () => {
    const res = await request(app).patch('/adventurers/adv-patch').send({ name: 'Drakeon' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Drakeon');
    expect(res.body.class).toBe('apprentice');
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).patch('/adventurers/ghost').send({ name: 'Nobody' });
    expect(res.status).toBe(404);
  });

  it('rejects invalid class in patch', async () => {
    const res = await request(app).patch('/adventurers/adv-patch').send({ class: 'warlock' });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('class');
  });
});

describe('PATCH /adventurers/:id/style', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
    db.prepare('INSERT INTO adventurers (id, name, class, model_id) VALUES (?, ?, ?, ?)').run(
      'adv-style', 'Fionn', 'champion', 'claude-opus-4-7',
    );
  });

  afterEach(() => {
    db.close();
  });

  it('updates style and returns the updated adventurer', async () => {
    const res = await request(app)
      .patch('/adventurers/adv-style/style')
      .send({ style: { tunic: 'blue', hair: 'silver' } });
    expect(res.status).toBe(200);
    expect(res.body.style).toEqual({ tunic: 'blue', hair: 'silver' });

    const row = db.prepare('SELECT style_json FROM adventurers WHERE id = ?').get('adv-style') as {
      style_json: string;
    };
    expect(JSON.parse(row.style_json)).toEqual({ tunic: 'blue', hair: 'silver' });
  });

  it('accepts a partial style (tunic only)', async () => {
    const res = await request(app)
      .patch('/adventurers/adv-style/style')
      .send({ style: { tunic: 'gold' } });
    expect(res.status).toBe(200);
    expect(res.body.style).toEqual({ tunic: 'gold' });
  });

  it('accepts an empty style object (reset)', async () => {
    const res = await request(app).patch('/adventurers/adv-style/style').send({ style: {} });
    expect(res.status).toBe(200);
    expect(res.body.style).toEqual({});
  });

  it('rejects an invalid tunic color with 400', async () => {
    const res = await request(app)
      .patch('/adventurers/adv-style/style')
      .send({ style: { tunic: 'rainbow' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .patch('/adventurers/ghost/style')
      .send({ style: { tunic: 'red' } });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /adventurers/:id', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
    db.prepare('INSERT INTO adventurers (id, name, class, model_id) VALUES (?, ?, ?, ?)').run(
      'adv-del', 'Elara', 'scout', 'claude-opus-4-7',
    );
  });

  afterEach(() => {
    db.close();
  });

  it('deletes an adventurer and returns 204', async () => {
    const res = await request(app).delete('/adventurers/adv-del');
    expect(res.status).toBe(204);
    const check = db.prepare('SELECT id FROM adventurers WHERE id = ?').get('adv-del');
    expect(check).toBeUndefined();
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).delete('/adventurers/ghost');
    expect(res.status).toBe(404);
  });
});
