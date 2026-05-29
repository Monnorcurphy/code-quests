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

const validBody = {
  name: 'Slug',
  spritePath: 'monsters/slug.png',
  defaultDifficulty: 2,
  failureSignature: 'eslint.*no-unused-vars',
};

describe('POST /monsters/types', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => { ({ app, db } = makeApp()); });
  afterEach(() => { db.close(); });

  it('returns 201 with created_by="user" on happy path', async () => {
    const res = await request(app).post('/monsters/types').send(validBody);
    expect(res.status).toBe(201);
    expect(res.body.createdBy).toBe('user');
    expect(res.body.id).toBe('user:slug');
    expect(res.body.name).toBe('Slug');
    expect(res.body.spritePath).toBe('monsters/slug.png');
    expect(res.body.defaultDifficulty).toBe(2);
    expect(res.body.failureSignature).toBe('eslint.*no-unused-vars');
  });

  it('returns 409 with field="name" on duplicate id', async () => {
    await request(app).post('/monsters/types').send(validBody);
    const res = await request(app).post('/monsters/types').send(validBody);
    expect(res.status).toBe(409);
    expect(res.body.field).toBe('name');
  });

  it('returns 400 when failureSignature is an invalid regex', async () => {
    const res = await request(app).post('/monsters/types').send({
      ...validBody,
      failureSignature: '[invalid(',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when defaultDifficulty is 0', async () => {
    const res = await request(app).post('/monsters/types').send({
      ...validBody,
      defaultDifficulty: 0,
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when defaultDifficulty is 6', async () => {
    const res = await request(app).post('/monsters/types').send({
      ...validBody,
      defaultDifficulty: 6,
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when name has no ASCII alphanumerics', async () => {
    const res = await request(app).post('/monsters/types').send({
      ...validBody,
      name: '***',
    });
    expect(res.status).toBe(400);
  });

  it('CHECK constraint rejects created_by other than system/user', () => {
    expect(() => {
      db.prepare(
        `INSERT INTO monster_types (id, name, sprite_path, default_difficulty, failure_signature, created_by)
         VALUES ('bad:type', 'Bad', 'monsters/bad.png', 1, 'bad', 'someone-else')`,
      ).run();
    }).toThrow();
  });
});
