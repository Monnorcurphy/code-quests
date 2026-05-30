import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({ default: vi.fn() }));
vi.mock('../agents/select-adapter', () => ({
  getQuestAdapter: vi.fn(),
  getDefaultQuestAdapter: vi.fn(),
  getAdapterForModel: vi.fn(),
  getAuditAdapter: vi.fn(),
}));

vi.mock('../services/adventure-framing', () => ({
  frameUserBlocker: vi.fn().mockResolvedValue('The adventurer awaits.'),
  frameInputRequest: vi.fn().mockResolvedValue('A vision appears.'),
}));

import request from 'supertest';
import express from 'express';
import type { AgentEvent } from '@code-quests/shared';
import { AdventurerSchema, QuestSchema } from '@code-quests/shared';
import Database from 'better-sqlite3';
import { openDb } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { createQuestsRouter } from '../routes/quests';
import { errorHandler } from '../middleware/errors';
import { runQuest } from '../services/quest-runner';
import { getDefaultQuestAdapter } from '../agents/select-adapter';
import { offlineAdapter } from '../agents/offline-adapter';
import { frameUserBlocker } from '../services/adventure-framing';

function makeApp(db: Database.Database, getChannel?: () => { publishQuestEvent: (questId: string, event: AgentEvent) => void } | undefined) {
  const app = express();
  app.use(express.json());
  app.use('/quests', createQuestsRouter(db, getChannel));
  app.use(errorHandler);
  return app;
}

function insertAdventurer(db: Database.Database, id: string) {
  db.prepare(
    `INSERT INTO adventurers (id, name, class, model_id) VALUES (?, ?, ?, ?)`,
  ).run(id, `Hero ${id}`, 'ranger', 'claude-haiku');
}

function insertQuest(
  db: Database.Database,
  id: string,
  advId: string,
  status = 'active',
) {
  db.prepare(
    `INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json, status, adventurer_id, equipment_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    'Test Quest',
    'A long description that should be meaningful',
    JSON.stringify(['Task done']),
    JSON.stringify(['Edge case 1']),
    status,
    advId,
    JSON.stringify({ skillIds: [], toolIds: [], mcpServerIds: [] }),
  );
}

function parseQuest(db: Database.Database, id: string) {
  const r = db.prepare('SELECT * FROM quests WHERE id = ?').get(id) as Record<string, unknown>;
  return QuestSchema.parse({
    id: r['id'],
    epicId: r['epic_id'] ?? null,
    title: r['title'],
    description: r['description'],
    acceptanceCriteria: JSON.parse(r['acceptance_criteria_json'] as string) as string[],
    edgeCases: JSON.parse(r['edge_cases_json'] as string) as string[],
    context: r['context'],
    status: r['status'],
    adventurerId: r['adventurer_id'] ?? null,
    agentId: r['agent_id'] ?? null,
    equipment: JSON.parse(r['equipment_json'] as string),
    specAudit: null,
    failureSummary: null,
    createdAt: r['created_at'],
    updatedAt: r['updated_at'],
  });
}

function parseAdventurer(db: Database.Database, id: string) {
  const r = db.prepare('SELECT * FROM adventurers WHERE id = ?').get(id) as Record<string, unknown>;
  return AdventurerSchema.parse({
    id: r['id'],
    name: r['name'],
    class: r['class'],
    modelId: r['model_id'],
    createdAt: r['created_at'],
    stats: JSON.parse(r['stats_json'] as string),
    specializations: JSON.parse(r['specializations_json'] as string),
    scars: JSON.parse(r['scars_json'] as string),
  });
}

// ---------------------------------------------------------------------------
// POST /quests/:id/respond-input
// ---------------------------------------------------------------------------

describe('POST /quests/:id/respond-input', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    vi.mocked(getDefaultQuestAdapter).mockReturnValue(offlineAdapter);
  });

  afterEach(() => {
    vi.clearAllMocks();
    db.close();
  });

  it('returns 404 for unknown quest', async () => {
    const app = makeApp(db);
    const res = await request(app).post('/quests/ghost/respond-input').send({ text: 'hello' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  it('returns 400 when text is missing', async () => {
    insertAdventurer(db, 'adv-ri-val');
    insertQuest(db, 'q-ri-val', 'adv-ri-val', 'paused_input');
    const app = makeApp(db);
    const res = await request(app).post('/quests/q-ri-val/respond-input').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when text exceeds max length', async () => {
    insertAdventurer(db, 'adv-ri-max');
    insertQuest(db, 'q-ri-max', 'adv-ri-max', 'paused_input');
    const app = makeApp(db);
    const res = await request(app).post('/quests/q-ri-max/respond-input').send({ text: 'x'.repeat(4001) });
    expect(res.status).toBe(400);
  });

  it('returns 409 when quest is in a terminal status (complete/failed)', async () => {
    // Chat dock support: respond-input now also accepts 'active' (mid-quest
    // chat). Terminal statuses still return 409.
    insertAdventurer(db, 'adv-ri-409');
    insertQuest(db, 'q-ri-409', 'adv-ri-409', 'complete');
    const app = makeApp(db);
    const res = await request(app).post('/quests/q-ri-409/respond-input').send({ text: 'answer' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBeTruthy();
  });

  it('returns 410 when quest is paused_input but no active handle exists', async () => {
    insertAdventurer(db, 'adv-ri-410');
    insertQuest(db, 'q-ri-410', 'adv-ri-410', 'paused_input');
    const app = makeApp(db);
    const res = await request(app).post('/quests/q-ri-410/respond-input').send({ text: 'answer' });
    expect(res.status).toBe(410);
    expect(res.body.error).toBeTruthy();
  });

  it('full pause→respond cycle: returns updated quest and quest eventually completes', async () => {
    insertAdventurer(db, 'adv-ri-full');
    insertQuest(db, 'q-ri-full', 'adv-ri-full', 'active');
    const app = makeApp(db);

    const quest = parseQuest(db, 'q-ri-full');
    const adventurer = parseAdventurer(db, 'adv-ri-full');

    let pausedInputResolve!: () => void;
    const pausedInputFired = new Promise<void>((res) => { pausedInputResolve = res; });

    const { done } = await runQuest(quest, adventurer, {
      db,
      publishEvent: (_questId, event) => {
        if (event.type === 'paused_input' && !event.adventureFraming) {
          pausedInputResolve();
        }
      },
    });

    await pausedInputFired;

    const paused = db.prepare('SELECT status FROM quests WHERE id = ?').get('q-ri-full') as { status: string };
    expect(paused.status).toBe('paused_input');

    const res = await request(app).post('/quests/q-ri-full/respond-input').send({ text: 'use approach A' });
    expect(res.status).toBe(200);

    await done;

    const finalRow = db.prepare('SELECT status FROM quests WHERE id = ?').get('q-ri-full') as { status: string };
    expect(finalRow.status).toBe('complete');
  });
});

// ---------------------------------------------------------------------------
// POST /quests/:id/block
// ---------------------------------------------------------------------------

describe('POST /quests/:id/block', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    vi.clearAllMocks();
    db.close();
  });

  it('returns 404 for unknown quest', async () => {
    const app = makeApp(db);
    const res = await request(app).post('/quests/ghost/block').send({ description: 'blocked' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  it('returns 400 when description is missing', async () => {
    insertAdventurer(db, 'adv-blk-val');
    insertQuest(db, 'q-blk-val', 'adv-blk-val', 'active');
    const app = makeApp(db);
    const res = await request(app).post('/quests/q-blk-val/block').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when description exceeds max length', async () => {
    insertAdventurer(db, 'adv-blk-max');
    insertQuest(db, 'q-blk-max', 'adv-blk-max', 'active');
    const app = makeApp(db);
    const res = await request(app).post('/quests/q-blk-max/block').send({ description: 'x'.repeat(1001) });
    expect(res.status).toBe(400);
  });

  it('returns 409 when quest is idle', async () => {
    insertAdventurer(db, 'adv-blk-409');
    insertQuest(db, 'q-blk-409', 'adv-blk-409', 'idle');
    const app = makeApp(db);
    const res = await request(app).post('/quests/q-blk-409/block').send({ description: 'waiting' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBeTruthy();
  });

  it('returns 409 when quest is already user_blocked', async () => {
    insertAdventurer(db, 'adv-blk-alr');
    insertQuest(db, 'q-blk-alr', 'adv-blk-alr', 'user_blocked');
    const app = makeApp(db);
    const res = await request(app).post('/quests/q-blk-alr/block').send({ description: 'still blocked' });
    expect(res.status).toBe(409);
  });

  it('transitions active quest to user_blocked and persists user_blocker_json', async () => {
    insertAdventurer(db, 'adv-blk-ok');
    insertQuest(db, 'q-blk-ok', 'adv-blk-ok', 'active');
    const app = makeApp(db);

    const res = await request(app).post('/quests/q-blk-ok/block').send({ description: 'Need team input' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('user_blocked');
    expect(res.body.userBlocker).toBeTruthy();
    expect(res.body.userBlocker.rawDescription).toBe('Need team input');
    expect(res.body.userBlocker.markedAt).toBeTruthy();

    const dbRow = db.prepare('SELECT status, user_blocker_json FROM quests WHERE id = ?').get('q-blk-ok') as {
      status: string;
      user_blocker_json: string | null;
    };
    expect(dbRow.status).toBe('user_blocked');
    expect(dbRow.user_blocker_json).not.toBeNull();
    const parsed = JSON.parse(dbRow.user_blocker_json!) as { rawDescription: string; markedAt: string };
    expect(parsed.rawDescription).toBe('Need team input');
    expect(parsed.markedAt).toBeTruthy();
  });

  it('can block a quest that is in paused_input status', async () => {
    insertAdventurer(db, 'adv-blk-pi');
    insertQuest(db, 'q-blk-pi', 'adv-blk-pi', 'paused_input');
    const app = makeApp(db);

    const res = await request(app).post('/quests/q-blk-pi/block').send({ description: 'Need to ask the team' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('user_blocked');
  });

  it('publishes status_change event via channel', async () => {
    insertAdventurer(db, 'adv-blk-ch');
    insertQuest(db, 'q-blk-ch', 'adv-blk-ch', 'active');
    const publishedEvents: { questId: string; event: AgentEvent }[] = [];
    const app = makeApp(db, () => ({
      publishQuestEvent(questId: string, event: AgentEvent) {
        publishedEvents.push({ questId, event });
      },
    }));

    await request(app).post('/quests/q-blk-ch/block').send({ description: 'blocked' });

    const statusChangeEvents = publishedEvents.filter((e) => e.event.type === 'status_change');
    expect(statusChangeEvents).toHaveLength(1);
    const evt = statusChangeEvents[0].event;
    if (evt.type === 'status_change') {
      expect(evt.from).toBe('active');
      expect(evt.to).toBe('user_blocked');
    }
  });

  it('cancels the active agent handle when blocking', async () => {
    insertAdventurer(db, 'adv-blk-cancel');
    insertQuest(db, 'q-blk-cancel', 'adv-blk-cancel', 'active');

    let cancelCalled = false;
    let releasePause!: () => void;
    const pausePromise = new Promise<void>((resolve) => { releasePause = resolve; });

    vi.mocked(getDefaultQuestAdapter).mockReturnValueOnce({
      name: 'mock-block-cancel',
      async spawn() {
        return {
          pid: null,
          async *events(): AsyncGenerator<AgentEvent> {
            yield { type: 'progress', timestamp: new Date().toISOString(), message: 'Working' };
            await pausePromise;
          },
          async cancel() {
            cancelCalled = true;
            releasePause();
          },
          async respond() {},
          async awaitExit() { return { exitCode: null }; },
        };
      },
    });

    const quest = parseQuest(db, 'q-blk-cancel');
    const adventurer = parseAdventurer(db, 'adv-blk-cancel');

    let progressFired!: () => void;
    const progressReceived = new Promise<void>((resolve) => { progressFired = resolve; });

    const { done } = await runQuest(quest, adventurer, {
      db,
      publishEvent: (_questId, event) => {
        if (event.type === 'progress') progressFired();
      },
    });

    await progressReceived;

    const app = makeApp(db);
    const res = await request(app).post('/quests/q-blk-cancel/block').send({ description: 'Need info' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('user_blocked');

    await done;
    expect(cancelCalled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// POST /quests/:id/unblock
// ---------------------------------------------------------------------------

describe('POST /quests/:id/unblock', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    vi.clearAllMocks();
    db.close();
  });

  it('returns 404 for unknown quest', async () => {
    const app = makeApp(db);
    const res = await request(app).post('/quests/ghost/unblock');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  it('returns 409 when quest is not user_blocked', async () => {
    insertAdventurer(db, 'adv-ub-409');
    insertQuest(db, 'q-ub-409', 'adv-ub-409', 'active');
    const app = makeApp(db);
    const res = await request(app).post('/quests/q-ub-409/unblock');
    expect(res.status).toBe(409);
    expect(res.body.error).toBeTruthy();
  });

  it('transitions user_blocked quest to active and sets unblockedAt', async () => {
    insertAdventurer(db, 'adv-ub-ok');
    insertQuest(db, 'q-ub-ok', 'adv-ub-ok', 'user_blocked');
    const markedAt = new Date().toISOString();
    db.prepare('UPDATE quests SET user_blocker_json = ? WHERE id = ?').run(
      JSON.stringify({ rawDescription: 'Needed team input', markedAt }),
      'q-ub-ok',
    );

    // instant-complete adapter so runQuest exits cleanly
    vi.mocked(getDefaultQuestAdapter).mockReturnValueOnce({
      name: 'mock-unblock',
      async spawn() {
        return {
          pid: null,
          async *events(): AsyncGenerator<AgentEvent> {
            yield { type: 'completed', timestamp: new Date().toISOString() };
          },
          async cancel() {},
          async respond() {},
          async awaitExit() { return { exitCode: 0 }; },
        };
      },
    });

    const app = makeApp(db);
    const res = await request(app).post('/quests/q-ub-ok/unblock');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');

    const dbRow = db.prepare('SELECT user_blocker_json FROM quests WHERE id = ?').get('q-ub-ok') as {
      user_blocker_json: string;
    };
    const blocker = JSON.parse(dbRow.user_blocker_json) as { markedAt: string; unblockedAt?: string };
    expect(blocker.unblockedAt).toBeTruthy();
  });

  it('spawns a fresh agent after unblocking', async () => {
    insertAdventurer(db, 'adv-ub-spawn');
    insertQuest(db, 'q-ub-spawn', 'adv-ub-spawn', 'user_blocked');
    const markedAt = new Date().toISOString();
    db.prepare('UPDATE quests SET user_blocker_json = ? WHERE id = ?').run(
      JSON.stringify({ rawDescription: 'Blocked for a reason', markedAt }),
      'q-ub-spawn',
    );

    vi.mocked(getDefaultQuestAdapter).mockReturnValueOnce({
      name: 'mock-unblock-spawn',
      async spawn() {
        return {
          pid: null,
          async *events(): AsyncGenerator<AgentEvent> {
            yield { type: 'completed', timestamp: new Date().toISOString() };
          },
          async cancel() {},
          async respond() {},
          async awaitExit() { return { exitCode: 0 }; },
        };
      },
    });

    const app = makeApp(db);
    const res = await request(app).post('/quests/q-ub-spawn/unblock');
    expect(res.status).toBe(200);

    const agentRow = db.prepare(
      'SELECT id FROM agents WHERE quest_id = ? ORDER BY started_at DESC LIMIT 1',
    ).get('q-ub-spawn') as { id: string } | undefined;
    expect(agentRow).toBeDefined();
    expect(agentRow!.id).toBeTruthy();
  });

  it('publishes status_change event via channel on unblock', async () => {
    insertAdventurer(db, 'adv-ub-ch');
    insertQuest(db, 'q-ub-ch', 'adv-ub-ch', 'user_blocked');
    const markedAt = new Date().toISOString();
    db.prepare('UPDATE quests SET user_blocker_json = ? WHERE id = ?').run(
      JSON.stringify({ rawDescription: 'Waiting on stakeholders', markedAt }),
      'q-ub-ch',
    );

    vi.mocked(getDefaultQuestAdapter).mockReturnValueOnce({
      name: 'mock-unblock-ch',
      async spawn() {
        return {
          pid: null,
          async *events(): AsyncGenerator<AgentEvent> {
            yield { type: 'completed', timestamp: new Date().toISOString() };
          },
          async cancel() {},
          async respond() {},
          async awaitExit() { return { exitCode: 0 }; },
        };
      },
    });

    const publishedEvents: { questId: string; event: AgentEvent }[] = [];
    const app = makeApp(db, () => ({
      publishQuestEvent(questId: string, event: AgentEvent) {
        publishedEvents.push({ questId, event });
      },
    }));

    await request(app).post('/quests/q-ub-ch/unblock');

    const statusChangeEvents = publishedEvents.filter((e) => e.event.type === 'status_change');
    const unblockChange = statusChangeEvents.find((e) => {
      const evt = e.event;
      return evt.type === 'status_change' && evt.from === 'user_blocked' && evt.to === 'active';
    });
    expect(unblockChange).toBeDefined();
  });

  it('full block → unblock cycle: quest completes after unblock respawns the agent', async () => {
    insertAdventurer(db, 'adv-full-cycle');
    insertQuest(db, 'q-full-cycle', 'adv-full-cycle', 'active');

    const app = makeApp(db);

    // Block
    const blockRes = await request(app).post('/quests/q-full-cycle/block').send({ description: 'Team review needed' });
    expect(blockRes.status).toBe(200);
    expect(blockRes.body.status).toBe('user_blocked');

    // Unblock with instant-complete adapter
    vi.mocked(getDefaultQuestAdapter).mockReturnValueOnce({
      name: 'mock-full-cycle',
      async spawn() {
        return {
          pid: null,
          async *events(): AsyncGenerator<AgentEvent> {
            yield { type: 'completed', timestamp: new Date().toISOString() };
          },
          async cancel() {},
          async respond() {},
          async awaitExit() { return { exitCode: 0 }; },
        };
      },
    });

    const unblockRes = await request(app).post('/quests/q-full-cycle/unblock');
    expect(unblockRes.status).toBe(200);
    expect(unblockRes.body.status).toBe('active');

    // The agent completes asynchronously; wait for it
    const agentRow = db.prepare(
      'SELECT id FROM agents WHERE quest_id = ? ORDER BY started_at DESC LIMIT 1',
    ).get('q-full-cycle') as { id: string } | undefined;
    expect(agentRow).toBeDefined();

    // The blocker should have unblockedAt set
    const questRow = db.prepare('SELECT user_blocker_json FROM quests WHERE id = ?').get('q-full-cycle') as {
      user_blocker_json: string;
    };
    const blocker = JSON.parse(questRow.user_blocker_json) as { markedAt: string; unblockedAt?: string };
    expect(blocker.markedAt).toBeTruthy();
    expect(blocker.unblockedAt).toBeTruthy();
  });

  it('framing writeback does not overwrite unblockedAt from a concurrent unblock', async () => {
    insertAdventurer(db, 'adv-blk-race');
    insertQuest(db, 'q-blk-race', 'adv-blk-race', 'active');

    let resolveFraming!: (value: string) => void;
    const framingPromise = new Promise<string>((resolve) => { resolveFraming = resolve; });
    vi.mocked(frameUserBlocker).mockReturnValueOnce(framingPromise);

    vi.mocked(getDefaultQuestAdapter).mockReturnValueOnce({
      name: 'mock-race',
      async spawn() {
        return {
          pid: null,
          async *events(): AsyncGenerator<AgentEvent> {
            yield { type: 'completed', timestamp: new Date().toISOString() };
          },
          async cancel() {},
          async respond() {},
          async awaitExit() { return { exitCode: 0 }; },
        };
      },
    });

    const app = makeApp(db);

    // Block the quest — framing is now in flight (deferred)
    const blockRes = await request(app)
      .post('/quests/q-blk-race/block')
      .send({ description: 'Awaiting security review' });
    expect(blockRes.status).toBe(200);

    // Unblock before framing resolves — sets unblockedAt
    const unblockRes = await request(app).post('/quests/q-blk-race/unblock');
    expect(unblockRes.status).toBe(200);

    const rowAfterUnblock = db.prepare('SELECT user_blocker_json FROM quests WHERE id = ?').get('q-blk-race') as {
      user_blocker_json: string;
    };
    const blockerAfterUnblock = JSON.parse(rowAfterUnblock.user_blocker_json) as { unblockedAt?: string };
    expect(blockerAfterUnblock.unblockedAt).toBeTruthy();

    // Resolve the framing — the gate must not overwrite unblockedAt
    resolveFraming('The hero rests at camp, awaiting word from the council.');
    await framingPromise;
    await new Promise<void>((r) => setImmediate(r));

    const rowFinal = db.prepare('SELECT user_blocker_json FROM quests WHERE id = ?').get('q-blk-race') as {
      user_blocker_json: string;
    };
    const blockerFinal = JSON.parse(rowFinal.user_blocker_json) as {
      unblockedAt?: string;
      adventureFraming?: string;
    };
    expect(blockerFinal.unblockedAt).toBeTruthy();
    expect(blockerFinal.adventureFraming).toBeUndefined();
  });
});
