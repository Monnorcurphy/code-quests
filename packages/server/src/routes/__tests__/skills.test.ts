import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import { openDb } from '../../db/connection';
import { runMigrations } from '../../db/migrator';
import { createSkillsRouter } from '../skills';
import { errorHandler } from '../../middleware/errors';

function makeApp() {
  const db = openDb(':memory:');
  runMigrations(db);
  const app = express();
  app.use(express.json());
  app.use('/', createSkillsRouter(db));
  app.use(errorHandler);
  return { app, db };
}

function seedSkill(db: Database.Database, overrides: Partial<{
  id: string; name: string; status: string; createdBy: string; implementation: string; monsterTypeIds: string[];
}> = {}) {
  const id = overrides.id ?? 'skill-1';
  const name = overrides.name ?? 'Test Skill';
  const status = overrides.status ?? 'active';
  const createdBy = overrides.createdBy ?? 'system';
  const implementation = overrides.implementation ?? '';
  const monsterTypeIds = overrides.monsterTypeIds ?? [];
  db.prepare(
    `INSERT INTO skills (id, name, monster_type_ids_json, status, created_by, hit_count, implementation)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
  ).run(id, name, JSON.stringify(monsterTypeIds), status, createdBy, implementation);
  return id;
}

describe('GET /', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => { ({ app, db } = makeApp()); });
  afterEach(() => { db.close(); });

  it('returns all skills including seeded ones', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Seeds from migration 002 include linters_bane, etc.
    const ids = (res.body as Array<{ id: string }>).map((s) => s.id);
    expect(ids).toContain('linters_bane');
  });

  it('filters by status=active', async () => {
    seedSkill(db, { id: 'cand-1', status: 'candidate' });
    const res = await request(app).get('/?status=active');
    expect(res.status).toBe(200);
    const statuses = (res.body as Array<{ status: string }>).map((s) => s.status);
    expect(statuses.every((s) => s === 'active')).toBe(true);
  });

  it('filters by status=candidate', async () => {
    seedSkill(db, { id: 'cand-1', status: 'candidate' });
    const res = await request(app).get('/?status=candidate');
    expect(res.status).toBe(200);
    expect((res.body as unknown[]).length).toBeGreaterThanOrEqual(1);
    const statuses = (res.body as Array<{ status: string }>).map((s) => s.status);
    expect(statuses.every((s) => s === 'candidate')).toBe(true);
  });

  it('filters by status=retired', async () => {
    seedSkill(db, { id: 'ret-1', status: 'retired' });
    const res = await request(app).get('/?status=retired');
    expect(res.status).toBe(200);
    const statuses = (res.body as Array<{ status: string }>).map((s) => s.status);
    expect(statuses.every((s) => s === 'retired')).toBe(true);
  });

  it('returns 400 for invalid status query', async () => {
    const res = await request(app).get('/?status=unknown');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ field: 'status' });
  });
});

describe('GET /:id', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => { ({ app, db } = makeApp()); });
  afterEach(() => { db.close(); });

  it('returns a skill by id', async () => {
    seedSkill(db, { id: 'skill-x', name: 'My Skill' });
    const res = await request(app).get('/skill-x');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'skill-x', name: 'My Skill' });
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/no-such-skill');
    expect(res.status).toBe(404);
  });
});

describe('POST / (forge)', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => { ({ app, db } = makeApp()); });
  afterEach(() => { db.close(); });

  it('creates a skill and returns 201', async () => {
    const res = await request(app).post('/').send({
      name: 'Shadow Strike',
      monsterTypeIds: ['goblin_linter'],
      implementation: 'Always lints first.',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Shadow Strike',
      status: 'active',
      createdBy: 'user',
      monsterTypeIds: ['goblin_linter'],
    });
    expect(res.body.id).toBeTruthy();
  });

  it('defaults implementation to empty string', async () => {
    const res = await request(app).post('/').send({
      name: 'Bare Skill',
      monsterTypeIds: ['goblin_linter'],
    });
    expect(res.status).toBe(201);
    expect(res.body.implementation).toBe('');
  });

  it('returns 400 with field=name when name is empty', async () => {
    const res = await request(app).post('/').send({
      name: '',
      monsterTypeIds: ['goblin_linter'],
    });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ field: 'name' });
  });

  it('returns 400 with field=name when name is missing', async () => {
    const res = await request(app).post('/').send({ monsterTypeIds: ['goblin_linter'] });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ field: 'name' });
  });

  it('returns 400 with field=monsterTypeIds when array is empty', async () => {
    const res = await request(app).post('/').send({ name: 'A Skill', monsterTypeIds: [] });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ field: 'monsterTypeIds' });
  });

  it('returns 400 with field=monsterTypeIds for unknown monster type', async () => {
    const res = await request(app).post('/').send({
      name: 'Ghost Skill',
      monsterTypeIds: ['nonexistent_type'],
    });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ field: 'monsterTypeIds' });
  });
});

describe('POST /:id/confirm', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => { ({ app, db } = makeApp()); });
  afterEach(() => { db.close(); });

  it('confirms a candidate and flips to active', async () => {
    seedSkill(db, { id: 'cand-1', status: 'candidate', name: 'Old Name' });
    const res = await request(app).post('/cand-1/confirm').send({});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'cand-1', status: 'active' });
  });

  it('overrides name and implementation when provided', async () => {
    seedSkill(db, { id: 'cand-2', status: 'candidate', name: 'Old Name', implementation: 'old' });
    const res = await request(app).post('/cand-2/confirm').send({
      name: 'New Name',
      implementation: 'new impl',
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'New Name', implementation: 'new impl', status: 'active' });
  });

  it('returns 400 when confirming an already-active skill', async () => {
    seedSkill(db, { id: 'act-1', status: 'active' });
    const res = await request(app).post('/act-1/confirm').send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown skill', async () => {
    const res = await request(app).post('/no-such/confirm').send({});
    expect(res.status).toBe(404);
  });
});

describe('POST /:id/dismiss', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => { ({ app, db } = makeApp()); });
  afterEach(() => { db.close(); });

  it('deletes a candidate and returns 204', async () => {
    seedSkill(db, { id: 'cand-3', status: 'candidate' });
    const res = await request(app).post('/cand-3/dismiss');
    expect(res.status).toBe(204);
    const row = db.prepare('SELECT * FROM skills WHERE id = ?').get('cand-3');
    expect(row).toBeUndefined();
  });

  it('returns 400 when dismissing a non-candidate', async () => {
    seedSkill(db, { id: 'act-2', status: 'active' });
    const res = await request(app).post('/act-2/dismiss');
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown skill', async () => {
    const res = await request(app).post('/no-such/dismiss');
    expect(res.status).toBe(404);
  });
});

describe('POST /:id/retire', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => { ({ app, db } = makeApp()); });
  afterEach(() => { db.close(); });

  it('retires an active skill and returns 200', async () => {
    seedSkill(db, { id: 'act-3', status: 'active' });
    const res = await request(app).post('/act-3/retire');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'act-3', status: 'retired' });
  });

  it('returns 400 when retiring a candidate (must confirm first)', async () => {
    seedSkill(db, { id: 'cand-4', status: 'candidate' });
    const res = await request(app).post('/cand-4/retire');
    expect(res.status).toBe(400);
  });

  it('returns 400 when retiring an already-retired skill', async () => {
    seedSkill(db, { id: 'ret-2', status: 'retired' });
    const res = await request(app).post('/ret-2/retire');
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown skill', async () => {
    const res = await request(app).post('/no-such/retire');
    expect(res.status).toBe(404);
  });
});
