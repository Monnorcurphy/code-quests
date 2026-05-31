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
import { createAdvisorsRouter } from '../advisors';
import { errorHandler } from '../../middleware/errors';
import { createModel } from '../../db/model-repository';
import { getSecret } from '../../lib/secret-store';

function makeApp() {
  const db = openDb(':memory:');
  runMigrations(db);
  const app = express();
  app.use(express.json());
  app.use('/advisors', createAdvisorsRouter(db));
  app.use(errorHandler);
  return { app, db };
}

function stubFetchWith(body: string, status = 200): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ choices: [{ message: { content: body } }] }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  return fn;
}

describe('POST /advisors/:kind/consult', () => {
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

  it('returns 404 for an unknown advisor kind', async () => {
    const res = await request(app).post('/advisors/blacksmith/consult').send({
      modelId: 'x', draftQuest: {}, userMessage: 'hi',
    });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/unknown advisor kind/);
  });

  it('routes the tavern advisor and surfaces npcName/npcRole in the response', async () => {
    const m = createModel(db, {
      id: 'or-1', name: 'OR Sonnet', provider: 'openrouter',
      modelId: 'anthropic/claude-3.5-sonnet', config: {},
    });
    vi.mocked(getSecret).mockResolvedValueOnce('sk-or-test');
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'A trap, then.' } }] }),
        { status: 200 },
      ),
    );

    const res = await request(app).post('/advisors/tavern/consult').send({
      modelId: m.id,
      draftQuest: { title: 'Make a thing' },
      userMessage: 'what could go wrong?',
    });

    expect(res.status).toBe(200);
    expect(res.body.npcName).toBe('Innkeep Rorek');
    expect(res.body.npcRole).toBe('Tavernkeeper');
    expect(res.body.kind).toBe('tavern');
  });

  it('the tavern advisor only accepts edgeCases in its proposal (drops a stray title)', async () => {
    const m = createModel(db, {
      id: 'ol-1', name: 'Local', provider: 'ollama', modelId: 'llama3.1', config: {},
    });
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          message: {
            content:
              'Prose first.\n\n[[PROPOSAL]]{"title":"DROP ME","edgeCases":["empty input","unicode names"]}[[/PROPOSAL]]',
          },
          done: true,
        }),
        { status: 200 },
      ),
    );

    const res = await request(app).post('/advisors/tavern/consult').send({
      modelId: m.id,
      draftQuest: { title: 'Original' },
      userMessage: 'go',
    });

    expect(res.status).toBe(200);
    expect(res.body.proposedRefinements).toEqual({
      edgeCases: ['empty input', 'unicode names'],
    });
    expect(res.body.proposedRefinements.title).toBeUndefined();
  });

  it('the oracle advisor accepts acceptanceCriteria, drops edgeCases', async () => {
    const m = createModel(db, {
      id: 'ol-2', name: 'Local', provider: 'ollama', modelId: 'llama3.1', config: {},
    });
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          message: {
            content:
              '...\n[[PROPOSAL]]{"acceptanceCriteria":["File X exists"],"edgeCases":["DROP"]}[[/PROPOSAL]]',
          },
          done: true,
        }),
        { status: 200 },
      ),
    );

    const res = await request(app).post('/advisors/oracle/consult').send({
      modelId: m.id, draftQuest: {}, userMessage: 'sharpen',
    });
    expect(res.body.proposedRefinements).toEqual({
      acceptanceCriteria: ['File X exists'],
    });
  });

  it('the library advisor accepts context + skillCandidates', async () => {
    const m = createModel(db, {
      id: 'ol-3', name: 'Local', provider: 'ollama', modelId: 'llama3.1', config: {},
    });
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          message: {
            content:
              'See:\n[[PROPOSAL]]{"context":"Project uses ESLint flat config.","skillCandidates":[{"name":"Lint Bane","description":"Auto-fix common lint warnings"}]}[[/PROPOSAL]]',
          },
          done: true,
        }),
        { status: 200 },
      ),
    );
    const res = await request(app).post('/advisors/library/consult').send({
      modelId: m.id, draftQuest: {}, userMessage: 'what should I know?',
    });
    expect(res.body.proposedRefinements.context).toBe('Project uses ESLint flat config.');
    expect(res.body.proposedRefinements.skillCandidates).toHaveLength(1);
    expect(res.body.proposedRefinements.skillCandidates[0].name).toBe('Lint Bane');
  });

  it('the armory advisor includes the catalogue in the user message when provided', async () => {
    const m = createModel(db, {
      id: 'ol-4', name: 'Local', provider: 'ollama', modelId: 'llama3.1', config: {},
    });
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          message: {
            content:
              'Bring the linter.\n[[PROPOSAL]]{"equipment":{"skillIds":["linters_bane"]}}[[/PROPOSAL]]',
          },
          done: true,
        }),
        { status: 200 },
      ),
    );

    const res = await request(app).post('/advisors/armory/consult').send({
      modelId: m.id,
      draftQuest: { title: 'Lint task' },
      userMessage: 'what should I pack?',
      catalogue: {
        skills: [{ id: 'linters_bane', name: "Linter's Bane" }],
        tools: [{ id: 'pnpm', name: 'pnpm' }],
        mcpServers: [],
      },
    });
    expect(res.body.proposedRefinements.equipment).toEqual({ skillIds: ['linters_bane'] });
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    const sentBody = JSON.parse(init.body as string) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(sentBody.messages[1].content).toContain('linters_bane — Linter\'s Bane');
  });

  it('the council advisor still works on /advisors/council/consult (back-compat path)', async () => {
    const m = createModel(db, {
      id: 'ol-5', name: 'Local', provider: 'ollama', modelId: 'llama3.1', config: {},
    });
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          message: {
            content:
              'OK.\n[[PROPOSAL]]{"title":"Sharper title"}[[/PROPOSAL]]',
          },
          done: true,
        }),
        { status: 200 },
      ),
    );
    const res = await request(app).post('/advisors/council/consult').send({
      modelId: m.id, draftQuest: {}, userMessage: 'go',
    });
    expect(res.status).toBe(200);
    expect(res.body.npcName).toBe('The Council');
    expect(res.body.proposedRefinements.title).toBe('Sharper title');
  });
});

// Touch stubFetchWith so the helper isn't flagged as unused when we don't use
// it in every test; it remains here for future scenarios.
void stubFetchWith;
