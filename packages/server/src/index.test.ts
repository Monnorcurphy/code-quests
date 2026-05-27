import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { openDb } from './db/connection';
import { runMigrations } from './db/migrator';
import { createApp } from './index';

describe('app', () => {
  function makeApp() {
    const db = openDb(':memory:');
    runMigrations(db);
    return { app: createApp(db), db };
  }

  it('creates an express application', () => {
    const { app } = makeApp();
    expect(app).toBeDefined();
    expect(typeof app.listen).toBe('function');
  });

  it('GET /health returns { status: "ok" }', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
