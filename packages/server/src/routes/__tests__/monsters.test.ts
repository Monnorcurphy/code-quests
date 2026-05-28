import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import { openDb } from '../../db/connection';
import { runMigrations } from '../../db/migrator';
import { createMonstersRouter } from '../monsters';
import { errorHandler } from '../../middleware/errors';

function makeApp() {
  const db = openDb(':memory:');
  runMigrations(db);
  const app = express();
  app.use(express.json());
  app.use('/', createMonstersRouter(db));
  app.use(errorHandler);
  return { app, db };
}

function seedMonster(db: Database.Database, overrides: Partial<{
  id: string; typeId: string; name: string; scope: string;
}> = {}) {
  const id = overrides.id ?? 'monster-1';
  const typeId = overrides.typeId ?? 'goblin_linter';
  const name = overrides.name ?? 'Lint Beast';
  const scope = overrides.scope ?? 'project';
  db.prepare(
    'INSERT INTO monsters (id, type_id, name, scope) VALUES (?, ?, ?, ?)',
  ).run(id, typeId, name, scope);
  return id;
}

function seedQuest(db: Database.Database, id = 'quest-1') {
  db.prepare('INSERT INTO quests (id, title) VALUES (?, ?)').run(id, 'Test Quest');
  return id;
}

function seedEncounter(db: Database.Database, opts: {
  id: string; monsterId: string; questId: string; appearedAt?: string; outcome?: string;
}) {
  db.prepare(
    'INSERT INTO monster_encounters (id, monster_id, quest_id, appeared_at, outcome) VALUES (?, ?, ?, ?, ?)',
  ).run(
    opts.id,
    opts.monsterId,
    opts.questId,
    opts.appearedAt ?? '2024-01-01T00:00:00',
    opts.outcome ?? 'escape',
  );
}

describe('GET /monster-types', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => { ({ app, db } = makeApp()); });
  afterEach(() => { db.close(); });

  it('returns 10 built-in types', async () => {
    const res = await request(app).get('/monster-types');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(10);
  });

  it('returns array not null', async () => {
    const res = await request(app).get('/monster-types');
    expect(res.body).not.toBeNull();
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns correct fields', async () => {
    const res = await request(app).get('/monster-types');
    const goblin = res.body.find((t: { id: string }) => t.id === 'goblin_linter');
    expect(goblin).toBeDefined();
    expect(goblin.name).toBe('Goblin');
    expect(goblin.spritePath).toBe('monsters/goblin.png');
    expect(goblin.defaultDifficulty).toBe(1);
    expect(goblin.createdBy).toBe('system');
  });
});

describe('GET /monsters', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => { ({ app, db } = makeApp()); });
  afterEach(() => { db.close(); });

  it('returns empty array when no monsters', async () => {
    const res = await request(app).get('/monsters');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns list of monsters', async () => {
    seedMonster(db);
    const res = await request(app).get('/monsters');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Lint Beast');
    expect(res.body[0].scope).toBe('project');
    expect(res.body[0].typeId).toBe('goblin_linter');
  });

  it('filters by scope=project', async () => {
    seedMonster(db, { id: 'm-1', scope: 'project' });
    seedMonster(db, { id: 'm-2', scope: 'guild' });
    const res = await request(app).get('/monsters?scope=project');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('m-1');
  });

  it('filters by scope=guild', async () => {
    seedMonster(db, { id: 'm-1', scope: 'project' });
    seedMonster(db, { id: 'm-2', scope: 'guild', typeId: 'imp_typecheck' });
    const res = await request(app).get('/monsters?scope=guild');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('m-2');
  });

  it('filters by typeId', async () => {
    seedMonster(db, { id: 'm-1', typeId: 'goblin_linter' });
    seedMonster(db, { id: 'm-2', typeId: 'imp_typecheck' });
    const res = await request(app).get('/monsters?typeId=goblin_linter');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('m-1');
  });

  it('returns 400 for invalid scope', async () => {
    const res = await request(app).get('/monsters?scope=enemy');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
    expect(res.body.field).toBe('scope');
  });

  it('returns camelCase fields', async () => {
    seedMonster(db);
    const res = await request(app).get('/monsters');
    const m = res.body[0];
    expect(m.typeId).toBeDefined();
    expect(m.firstSeenAt).toBeDefined();
    expect(m.lastSeenAt).toBeDefined();
    expect(m.calibratedDifficulty).toBeDefined();
  });
});

describe('GET /monsters/:id', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => { ({ app, db } = makeApp()); });
  afterEach(() => { db.close(); });

  it('returns 404 for unknown monster', async () => {
    const res = await request(app).get('/monsters/no-such-monster');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  it('returns the monster', async () => {
    seedMonster(db, { id: 'm-x', name: 'Shadow Imp' });
    const res = await request(app).get('/monsters/m-x');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('m-x');
    expect(res.body.name).toBe('Shadow Imp');
  });
});

describe('GET /monsters/:id/encounters', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => { ({ app, db } = makeApp()); });
  afterEach(() => { db.close(); });

  it('returns 404 for unknown monster', async () => {
    const res = await request(app).get('/monsters/no-such/encounters');
    expect(res.status).toBe(404);
  });

  it('returns empty array when no encounters', async () => {
    seedMonster(db);
    const res = await request(app).get('/monsters/monster-1/encounters');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns encounters newest first', async () => {
    const mId = seedMonster(db);
    const qId = seedQuest(db);
    seedEncounter(db, { id: 'e-1', monsterId: mId, questId: qId, appearedAt: '2024-01-01T10:00:00' });
    seedEncounter(db, { id: 'e-2', monsterId: mId, questId: qId, appearedAt: '2024-01-02T10:00:00' });
    const res = await request(app).get(`/monsters/${mId}/encounters`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe('e-2');
    expect(res.body[1].id).toBe('e-1');
  });

  it('includes combatLog and loot as arrays', async () => {
    const mId = seedMonster(db);
    const qId = seedQuest(db);
    seedEncounter(db, { id: 'e-1', monsterId: mId, questId: qId });
    const res = await request(app).get(`/monsters/${mId}/encounters`);
    expect(Array.isArray(res.body[0].combatLog)).toBe(true);
    expect(Array.isArray(res.body[0].loot)).toBe(true);
  });
});

describe('POST /monsters/:id/promote-nemesis', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => { ({ app, db } = makeApp()); });
  afterEach(() => { db.close(); });

  it('promotes a project monster to guild scope', async () => {
    seedMonster(db, { id: 'm-promo', scope: 'project' });
    const res = await request(app).post('/monsters/m-promo/promote-nemesis').send({});
    expect(res.status).toBe(200);
    expect(res.body.scope).toBe('guild');
    expect(res.body.projectId).toBeNull();
  });

  it('returns 404 for unknown monster', async () => {
    const res = await request(app).post('/monsters/no-such/promote-nemesis').send({});
    expect(res.status).toBe(404);
  });

  it('returns 400 if already a guild nemesis', async () => {
    seedMonster(db, { id: 'm-already-guild', scope: 'guild' });
    const res = await request(app).post('/monsters/m-already-guild/promote-nemesis').send({});
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('scope');
  });

  it('allows renaming the monster on promote', async () => {
    seedMonster(db, { id: 'm-rename', name: 'Old Name', scope: 'project' });
    const res = await request(app)
      .post('/monsters/m-rename/promote-nemesis')
      .send({ name: 'New Nemesis Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Nemesis Name');
    expect(res.body.scope).toBe('guild');
  });

  it('keeps existing name if no name provided', async () => {
    seedMonster(db, { id: 'm-keep-name', name: 'Keep Me', scope: 'project' });
    const res = await request(app).post('/monsters/m-keep-name/promote-nemesis').send({});
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Keep Me');
  });
});

describe('GET /quests/:questId/encounters', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => { ({ app, db } = makeApp()); });
  afterEach(() => { db.close(); });

  it('returns empty array for quest with no encounters', async () => {
    const res = await request(app).get('/quests/unknown-quest/encounters');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns encounters ordered by appeared_at ascending', async () => {
    const mId = seedMonster(db);
    const qId = seedQuest(db);
    seedEncounter(db, { id: 'e-2', monsterId: mId, questId: qId, appearedAt: '2024-01-02T10:00:00' });
    seedEncounter(db, { id: 'e-1', monsterId: mId, questId: qId, appearedAt: '2024-01-01T10:00:00' });
    const res = await request(app).get(`/quests/${qId}/encounters`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe('e-1');
    expect(res.body[1].id).toBe('e-2');
  });

  it('only returns encounters for the specified quest', async () => {
    const mId = seedMonster(db);
    const q1 = seedQuest(db, 'quest-a');
    const q2 = seedQuest(db, 'quest-b');
    seedEncounter(db, { id: 'e-a', monsterId: mId, questId: q1 });
    seedEncounter(db, { id: 'e-b', monsterId: mId, questId: q2 });
    const res = await request(app).get(`/quests/${q1}/encounters`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('e-a');
  });
});
