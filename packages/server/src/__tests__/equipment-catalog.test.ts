import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import { SkillSchema, ToolSchema, MCPServerSchema } from '@code-quests/shared';
import { openDb } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { createSkillsRouter } from '../routes/skills';
import { createToolsRouter } from '../routes/tools';
import { createMCPServersRouter } from '../routes/mcp-servers';
import { errorHandler } from '../middleware/errors';

function makeApp() {
  const db = openDb(':memory:');
  runMigrations(db);
  const app = express();
  app.use(express.json());
  app.use('/skills', createSkillsRouter(db));
  app.use('/tools', createToolsRouter(db));
  app.use('/mcp-servers', createMCPServersRouter(db));
  app.use(errorHandler);
  return { app, db };
}

describe('GET /skills', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
  });

  afterEach(() => {
    db.close();
  });

  it('returns all seeded skills', async () => {
    const res = await request(app).get('/skills');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
  });

  it('includes expected seed ids', async () => {
    const res = await request(app).get('/skills');
    const ids = (res.body as { id: string }[]).map((s) => s.id);
    expect(ids).toContain('linters_bane');
    expect(ids).toContain('type_whisperer');
    expect(ids).toContain('wraith_banisher');
    expect(ids).toContain('ac_cartographer');
  });

  it('every row parses against SkillSchema', async () => {
    const res = await request(app).get('/skills');
    for (const row of res.body as unknown[]) {
      expect(() => SkillSchema.parse(row)).not.toThrow();
    }
  });

  it('seed rows have status active and createdBy system', async () => {
    const res = await request(app).get('/skills');
    for (const skill of res.body as { status: string; createdBy: string }[]) {
      expect(skill.status).toBe('active');
      expect(skill.createdBy).toBe('system');
    }
  });

  it('running migrations twice does not duplicate rows', async () => {
    runMigrations(db);
    const res = await request(app).get('/skills');
    expect(res.body).toHaveLength(4);
  });
});

describe('GET /tools', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
  });

  afterEach(() => {
    db.close();
  });

  it('returns all seeded tools', async () => {
    const res = await request(app).get('/tools');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
  });

  it('includes expected seed ids', async () => {
    const res = await request(app).get('/tools');
    const ids = (res.body as { id: string }[]).map((t) => t.id);
    expect(ids).toContain('pnpm');
    expect(ids).toContain('gh');
    expect(ids).toContain('playwright_cli');
    expect(ids).toContain('jq');
  });

  it('every row parses against ToolSchema', async () => {
    const res = await request(app).get('/tools');
    for (const row of res.body as unknown[]) {
      expect(() => ToolSchema.parse(row)).not.toThrow();
    }
  });

  it('running migrations twice does not duplicate rows', async () => {
    runMigrations(db);
    const res = await request(app).get('/tools');
    expect(res.body).toHaveLength(4);
  });
});

describe('GET /mcp-servers', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    ({ app, db } = makeApp());
  });

  afterEach(() => {
    db.close();
  });

  it('returns all seeded mcp servers', async () => {
    const res = await request(app).get('/mcp-servers');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('includes expected seed ids', async () => {
    const res = await request(app).get('/mcp-servers');
    const ids = (res.body as { id: string }[]).map((m) => m.id);
    expect(ids).toContain('filesystem');
    expect(ids).toContain('github');
  });

  it('every row parses against MCPServerSchema', async () => {
    const res = await request(app).get('/mcp-servers');
    for (const row of res.body as unknown[]) {
      expect(() => MCPServerSchema.parse(row)).not.toThrow();
    }
  });

  it('config field is an object (not a string)', async () => {
    const res = await request(app).get('/mcp-servers');
    for (const server of res.body as { config: unknown }[]) {
      expect(typeof server.config).toBe('object');
      expect(server.config).not.toBeNull();
    }
  });

  it('running migrations twice does not duplicate rows', async () => {
    runMigrations(db);
    const res = await request(app).get('/mcp-servers');
    expect(res.body).toHaveLength(2);
  });
});
