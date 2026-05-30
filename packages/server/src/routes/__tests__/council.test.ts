import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';

vi.mock('../../lib/secret-store', () => ({
  getSecret: vi.fn(),
  setSecret: vi.fn(),
  hasSecret: vi.fn(),
  deleteSecret: vi.fn(),
}));

import { openDb } from '../../db/connection';
import { runMigrations } from '../../db/migrator';
import { createCouncilRouter } from '../council';
import { errorHandler } from '../../middleware/errors';
import { createModel } from '../../db/model-repository';
import { getSecret } from '../../lib/secret-store';

function makeApp() {
  const db = openDb(':memory:');
  runMigrations(db);
  const app = express();
  app.use(express.json());
  app.use('/council', createCouncilRouter(db));
  app.use(errorHandler);
  return { app, db };
}

describe('POST /council/consult', () => {
  let app: express.Express;
  let db: Database.Database;
  let originalFetch: typeof globalThis.fetch;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ({ app, db } = makeApp());
    originalFetch = globalThis.fetch;
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
    vi.mocked(getSecret).mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    db.close();
  });

  it('returns 404 when the model does not exist', async () => {
    const res = await request(app).post('/council/consult').send({
      modelId: 'ghost',
      draftQuest: {},
      userMessage: 'hi',
    });
    expect(res.status).toBe(404);
  });

  it('returns 409 when an openrouter model has no stored key', async () => {
    const m = createModel(db, {
      id: 'or-1',
      name: 'OR Sonnet',
      provider: 'openrouter',
      modelId: 'anthropic/claude-3.5-sonnet',
      config: {},
    });
    vi.mocked(getSecret).mockResolvedValueOnce(null);

    const res = await request(app).post('/council/consult').send({
      modelId: m.id,
      draftQuest: { title: 'X' },
      userMessage: 'hi',
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NO_KEY');
  });

  it('returns 400 when council model is claude_cli', async () => {
    const m = createModel(db, {
      id: 'cc-1',
      name: 'Claude Sonnet',
      provider: 'claude_cli',
      modelId: 'sonnet',
      config: {},
    });

    const res = await request(app).post('/council/consult').send({
      modelId: m.id,
      draftQuest: {},
      userMessage: 'hi',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cheap model/i);
  });

  it('returns the OpenRouter reply when the call succeeds', async () => {
    const m = createModel(db, {
      id: 'or-2',
      name: 'OR Sonnet',
      provider: 'openrouter',
      modelId: 'anthropic/claude-3.5-sonnet',
      config: {},
    });
    vi.mocked(getSecret).mockResolvedValueOnce('sk-or-test-fake');
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Sharpen the title.' } }],
          usage: { prompt_tokens: 100, completion_tokens: 5 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const res = await request(app)
      .post('/council/consult')
      .send({
        modelId: m.id,
        draftQuest: {
          title: 'Make a thing',
          description: 'Vague',
          acceptanceCriteria: [],
        },
        history: [],
        userMessage: 'Look at this draft.',
      });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('Sharpen the title.');
    expect(res.body.modelName).toBe('OR Sonnet');
    expect(res.body.tokenUsage).toMatchObject({ input: 100, output: 5 });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe('anthropic/claude-3.5-sonnet');
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toMatch(/Council/);
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[1].content).toContain('Make a thing');
    expect(body.messages.at(-1)).toMatchObject({
      role: 'user',
      content: 'Look at this draft.',
    });
  });

  it('returns 502 when the provider returns a non-2xx', async () => {
    const m = createModel(db, {
      id: 'or-3',
      name: 'OR Sonnet',
      provider: 'openrouter',
      modelId: 'anthropic/claude-3.5-sonnet',
      config: {},
    });
    vi.mocked(getSecret).mockResolvedValueOnce('sk-or-test-fake');
    fetchSpy.mockResolvedValueOnce(new Response('upstream error', { status: 500 }));

    const res = await request(app).post('/council/consult').send({
      modelId: m.id,
      draftQuest: {},
      userMessage: 'hi',
    });
    expect(res.status).toBe(502);
    expect(res.body.error).toContain('500');
  });

  it('rejects empty userMessage', async () => {
    const res = await request(app).post('/council/consult').send({
      modelId: 'whatever',
      draftQuest: {},
      userMessage: '',
    });
    expect(res.status).toBe(400);
  });

  it('returns a helpful error when Ollama is unreachable', async () => {
    const m = createModel(db, {
      id: 'ol-1',
      name: 'Local Llama',
      provider: 'ollama',
      modelId: 'llama3.1:8b',
      config: { baseUrl: 'http://localhost:11434' },
    });
    fetchSpy.mockRejectedValueOnce(new Error('fetch failed: ECONNREFUSED'));

    const res = await request(app).post('/council/consult').send({
      modelId: m.id,
      draftQuest: {},
      userMessage: 'hi',
    });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/install from https:\/\/ollama\.com/i);
  });

  it('threads conversation history into the request', async () => {
    const m = createModel(db, {
      id: 'or-4',
      name: 'OR Sonnet',
      provider: 'openrouter',
      modelId: 'anthropic/claude-3.5-sonnet',
      config: {},
    });
    vi.mocked(getSecret).mockResolvedValueOnce('sk-or-test-fake');
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }), {
        status: 200,
      }),
    );

    await request(app).post('/council/consult').send({
      modelId: m.id,
      draftQuest: { title: 'T' },
      history: [
        { role: 'user', content: 'first user turn' },
        { role: 'assistant', content: 'first assistant turn' },
      ],
      userMessage: 'second user turn',
    });

    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    // Expect: [system, draft-as-user, user, assistant, user]
    expect(body.messages).toHaveLength(5);
    expect(body.messages.map((m_) => m_.role)).toEqual([
      'system', 'user', 'user', 'assistant', 'user',
    ]);
    expect(body.messages[4].content).toBe('second user turn');
  });
});
