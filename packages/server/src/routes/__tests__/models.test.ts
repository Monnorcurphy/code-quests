import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import { openDb } from '../../db/connection';
import { runMigrations } from '../../db/migrator';
import { createModelsRouter } from '../models';
import { errorHandler } from '../../middleware/errors';
import { deleteSecret } from '../../lib/secret-store';

function makeApp() {
  const db = openDb(':memory:');
  runMigrations(db);
  const app = express();
  app.use(express.json());
  app.use('/models', createModelsRouter(db));
  app.use(errorHandler);
  return { app, db };
}

describe('models route', () => {
  let db: Database.Database;
  let app: express.Express;
  const createdIds: string[] = [];

  beforeEach(() => {
    ({ app, db } = makeApp());
  });

  afterEach(async () => {
    db.close();
    // Best-effort scrub of any secrets the live tests may have written to the
    // OS keychain. Tests run on macOS so this hits the real `security` CLI.
    for (const id of createdIds) {
      await deleteSecret(id).catch(() => undefined);
    }
    createdIds.length = 0;
  });

  describe('GET /models', () => {
    it('returns an empty array when no models exist', async () => {
      const res = await request(app).get('/models');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns hasKey: false for models without a stored secret', async () => {
      const created = await request(app)
        .post('/models')
        .send({ name: 'Local Llama', provider: 'ollama', modelId: 'llama3.1:70b' });
      expect(created.status).toBe(201);
      createdIds.push(created.body.id);

      const listed = await request(app).get('/models');
      expect(listed.status).toBe(200);
      expect(listed.body).toHaveLength(1);
      expect(listed.body[0].hasKey).toBe(false);
    });
  });

  describe('POST /models', () => {
    it('creates a Claude CLI model without an API key', async () => {
      const res = await request(app)
        .post('/models')
        .send({ name: 'Claude Sonnet', provider: 'claude_cli', modelId: 'sonnet' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        name: 'Claude Sonnet',
        provider: 'claude_cli',
        modelId: 'sonnet',
        hasKey: false,
      });
      expect(res.body.id).toBeTruthy();
      createdIds.push(res.body.id);
    });

    it('rejects an OpenRouter model with no API key', async () => {
      const res = await request(app)
        .post('/models')
        .send({
          name: 'OpenRouter Sonnet',
          provider: 'openrouter',
          modelId: 'anthropic/claude-3.5-sonnet',
        });
      expect(res.status).toBe(400);
      expect(res.body.field).toBe('apiKey');
    });

    it('stores the OpenRouter API key in the keychain and reports hasKey: true', async () => {
      const res = await request(app)
        .post('/models')
        .send({
          name: 'OpenRouter Sonnet',
          provider: 'openrouter',
          modelId: 'anthropic/claude-3.5-sonnet',
          apiKey: 'sk-or-test-stored',
        });
      expect(res.status).toBe(201);
      expect(res.body.hasKey).toBe(true);
      createdIds.push(res.body.id);

      // Subsequent GET must NEVER echo the apiKey field back.
      const listed = await request(app).get('/models');
      expect(listed.body[0]).not.toHaveProperty('apiKey');
      expect(listed.body[0].hasKey).toBe(true);
    });

    it('rejects unknown provider', async () => {
      const res = await request(app)
        .post('/models')
        .send({ name: 'X', provider: 'nope', modelId: 'whatever' });
      expect(res.status).toBe(400);
    });

    it('rejects empty name', async () => {
      const res = await request(app)
        .post('/models')
        .send({ name: '   ', provider: 'ollama', modelId: 'llama3.1' });
      expect(res.status).toBe(400);
    });

    it('persists the optional config object verbatim', async () => {
      const res = await request(app)
        .post('/models')
        .send({
          name: 'Local Llama',
          provider: 'ollama',
          modelId: 'llama3.1:70b',
          config: { baseUrl: 'http://localhost:11434', temperature: 0.4 },
        });
      expect(res.status).toBe(201);
      expect(res.body.config).toMatchObject({
        baseUrl: 'http://localhost:11434',
        temperature: 0.4,
      });
      createdIds.push(res.body.id);
    });
  });

  describe('GET /models/:id', () => {
    it('returns the model with hasKey', async () => {
      const created = await request(app)
        .post('/models')
        .send({ name: 'Local', provider: 'ollama', modelId: 'qwen2.5:7b' });
      createdIds.push(created.body.id);

      const res = await request(app).get(`/models/${created.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: created.body.id,
        name: 'Local',
        provider: 'ollama',
        hasKey: false,
      });
    });

    it('returns 404 for an unknown id', async () => {
      const res = await request(app).get('/models/not-a-real-id');
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /models/:id', () => {
    it('deletes the model and its keychain entry', async () => {
      const created = await request(app)
        .post('/models')
        .send({
          name: 'OpenRouter X',
          provider: 'openrouter',
          modelId: 'meta-llama/llama-3.3-70b',
          apiKey: 'sk-or-test-deletable',
        });
      const id = created.body.id;
      createdIds.push(id);

      const del = await request(app).delete(`/models/${id}`);
      expect(del.status).toBe(204);

      const after = await request(app).get(`/models/${id}`);
      expect(after.status).toBe(404);

      const list = await request(app).get('/models');
      expect(list.body).toEqual([]);
    });

    it('returns 404 when deleting a missing model', async () => {
      const res = await request(app).delete('/models/no-such-id');
      expect(res.status).toBe(404);
    });

    it('refuses with 409 when a quest still references the model', async () => {
      const created = await request(app)
        .post('/models')
        .send({ name: 'In-use', provider: 'ollama', modelId: 'llama3.1' });
      const modelId = created.body.id;
      createdIds.push(modelId);

      // Insert a quest that points to this model — adventurer FK is optional.
      db.prepare(
        `INSERT INTO quests
          (id, title, description, model_id, status, acceptance_criteria_json,
           edge_cases_json, equipment_json, current_scene)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run('q-using', 't', '', modelId, 'idle', '[]', '[]', '{}', 'quest-forest');

      const del = await request(app).delete(`/models/${modelId}`);
      expect(del.status).toBe(409);
      expect(del.body.code).toBe('MODEL_IN_USE');
      expect(del.body.questCount).toBe(1);

      // Model row should still exist.
      const stillThere = await request(app).get(`/models/${modelId}`);
      expect(stillThere.status).toBe(200);
    });
  });
});
