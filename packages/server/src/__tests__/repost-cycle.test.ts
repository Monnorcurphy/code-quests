import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({ default: vi.fn() }));
vi.mock('../agents/select-adapter', () => ({
  getQuestAdapter: vi.fn(),
  getDefaultQuestAdapter: vi.fn(),
  getAdapterForModel: vi.fn(),
  getAuditAdapter: vi.fn(),
}));

import Database from 'better-sqlite3';
import express from 'express';
import request from 'supertest';
import type { AgentEvent } from '@code-quests/shared';
import { QuestSchema, AdventurerSchema } from '@code-quests/shared';
import { openDb } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { seedShowcase } from '../scripts/seed-showcase';
import { runQuest } from '../services/quest-runner';
import { getDefaultQuestAdapter } from '../agents/select-adapter';
import { createQuestActionsRouter } from '../routes/quest-actions';
import { errorHandler } from '../middleware/errors';
import type { AgentAdapter, AgentHandle } from '../agents/adapter';

function createFailHandle(): AgentHandle {
  async function* generateEvents(): AsyncGenerator<AgentEvent> {
    const now = () => new Date().toISOString();
    // Three imp_typecheck combats to trigger the Lich aggregator
    yield { type: 'combat', timestamp: now(), monsterTypeId: 'imp_typecheck', message: 'Type error: cannot assign string to number' };
    yield { type: 'combat', timestamp: now(), monsterTypeId: 'imp_typecheck', message: 'Type error: property does not exist' };
    yield { type: 'combat', timestamp: now(), monsterTypeId: 'imp_typecheck', message: 'Type error: argument of type never' };
    yield { type: 'failed', timestamp: now(), reason: 'Repeated type errors — Lich emerged and the adventurer was slain.' };
  }
  const iter = generateEvents();
  return {
    pid: null,
    events: () => iter,
    cancel: async () => {},
    respond: async () => {},
    awaitExit: async () => ({ exitCode: 1 }),
  };
}

function createSucceedHandle(): AgentHandle {
  async function* generateEvents(): AsyncGenerator<AgentEvent> {
    const now = () => new Date().toISOString();
    yield { type: 'progress', timestamp: now(), message: 'Type errors neutralised by Type Whisperer' };
    yield { type: 'completed', timestamp: now(), summary: 'JWT migration complete. All ACs passing.' };
  }
  const iter = generateEvents();
  return {
    pid: null,
    events: () => iter,
    cancel: async () => {},
    respond: async () => {},
    awaitExit: async () => ({ exitCode: 0 }),
  };
}

function makeFailAdapter(): AgentAdapter {
  return { name: 'test-fail', spawn: async () => createFailHandle() };
}

function makeSucceedAdapter(): AgentAdapter {
  return { name: 'test-succeed', spawn: async () => createSucceedHandle() };
}

function parseQuest(db: Database.Database, id: string) {
  const row = db.prepare('SELECT * FROM quests WHERE id = ?').get(id) as Record<string, unknown>;
  return QuestSchema.parse({
    id: row['id'],
    epicId: row['epic_id'] ?? null,
    title: row['title'],
    description: row['description'],
    acceptanceCriteria: JSON.parse(row['acceptance_criteria_json'] as string) as string[],
    edgeCases: JSON.parse(row['edge_cases_json'] as string) as string[],
    context: (row['context'] as string) ?? '',
    status: row['status'],
    adventurerId: (row['adventurer_id'] as string) ?? null,
    agentId: (row['agent_id'] as string) ?? null,
    equipment: JSON.parse(row['equipment_json'] as string),
    specAudit: null,
    failureSummary: null,
    inputRequest: null,
    userBlocker: null,
    currentScene: (row['current_scene'] as string) ?? 'quest-forest',
    createdAt: row['created_at'] as string,
    updatedAt: row['updated_at'] as string,
  });
}

function parseAdventurer(db: Database.Database, id: string) {
  const row = db.prepare('SELECT * FROM adventurers WHERE id = ?').get(id) as Record<string, unknown>;
  return AdventurerSchema.parse({
    id: row['id'],
    name: row['name'],
    class: row['class'],
    modelId: row['model_id'],
    createdAt: row['created_at'],
    stats: JSON.parse(row['stats_json'] as string),
    specializations: JSON.parse(row['specializations_json'] as string),
    scars: JSON.parse(row['scars_json'] as string),
  });
}

describe('Repost cycle: fail → scar → repost → complete', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    seedShowcase(db);

    // Activate JWT quest, strip type_whisperer from equipment
    db.prepare(`UPDATE quests SET status = 'active', adventurer_id = ?, equipment_json = ? WHERE id = ?`).run(
      'adv-showcase-brielle',
      JSON.stringify({ skillIds: [], toolIds: ['gh'], mcpServerIds: ['filesystem'] }),
      'quest-showcase-jwt',
    );

    // Add completed quests for Brielle so lifetimeQuestCount >= 3 (bypasses scar grace period)
    for (let i = 1; i <= 3; i++) {
      db.prepare(
        `INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json,
          status, adventurer_id, equipment_json)
         VALUES (?, ?, ?, '[]', '[]', 'complete', ?, '{}')`,
      ).run(`quest-brielle-prior-${i}`, `Prior Quest ${i}`, 'A prior quest', 'adv-showcase-brielle');
    }

    // Pre-insert a prior agent record so retries = 2 (makes recommendation 'retire', not 'repost_with_clarification')
    // This simulates Brielle having already tried once before
    db.prepare(
      `INSERT INTO agents (id, adventurer_id, quest_id, events_json, started_at, ended_at, exit_code)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      'agent-prior-attempt',
      'adv-showcase-brielle',
      'quest-showcase-jwt',
      '[]',
      new Date(Date.now() - 3600_000).toISOString(),
      new Date(Date.now() - 3000_000).toISOString(),
      1,
    );

    app = express();
    app.use(express.json());
    app.use('/quests', createQuestActionsRouter(db));
    app.use(errorHandler);
  });

  afterEach(() => {
    vi.clearAllMocks();
    db.close();
  });

  it('records a scar after quest failure and completes after repost with new equipment', async () => {
    vi.mocked(getDefaultQuestAdapter).mockReturnValue(makeFailAdapter());

    const quest = parseQuest(db, 'quest-showcase-jwt');
    const brielle = parseAdventurer(db, 'adv-showcase-brielle');

    // Run quest to failure
    const { done } = await runQuest(quest, brielle, { db });
    await done;

    // Quest should be returned_to_town (detectAndHandleFailure is called synchronously)
    const statusRow = db.prepare('SELECT status FROM quests WHERE id = ?').get('quest-showcase-jwt') as { status: string };
    expect(statusRow.status).toBe('returned_to_town');

    // Brielle should have gained a scar
    const brielleAfter = parseAdventurer(db, 'adv-showcase-brielle');
    expect(brielleAfter.scars.length).toBeGreaterThan(0);

    const newScar = brielleAfter.scars[brielleAfter.scars.length - 1];
    expect(newScar.questId).toBe('quest-showcase-jwt');
    expect(newScar.monsterIdAtFatal).toBeTruthy();
    expect(newScar.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // Re-post the quest with type_whisperer equipped
    const repostRes = await request(app)
      .post('/quests/quest-showcase-jwt/actions/repost')
      .send({ adjustments: { equipment: { skillIds: ['type_whisperer'], toolIds: ['gh'], mcpServerIds: ['filesystem'] } } });
    expect(repostRes.status).toBe(201);

    const newQuestId = (repostRes.body as { id: string }).id;
    expect(newQuestId).toBeTruthy();

    // Activate the re-posted quest for Brielle
    db.prepare(`UPDATE quests SET status = 'active', adventurer_id = ? WHERE id = ?`).run(
      'adv-showcase-brielle',
      newQuestId,
    );

    vi.mocked(getDefaultQuestAdapter).mockReturnValue(makeSucceedAdapter());

    const repostedQuest = parseQuest(db, newQuestId);
    const brielleForRepost = parseAdventurer(db, 'adv-showcase-brielle');
    const { done: done2 } = await runQuest(repostedQuest, brielleForRepost, { db });
    await done2;

    // Re-posted quest should be complete
    const finalRow = db.prepare('SELECT status FROM quests WHERE id = ?').get(newQuestId) as { status: string };
    expect(finalRow.status).toBe('complete');

    // Scar is still present after the win
    const brielleWinner = parseAdventurer(db, 'adv-showcase-brielle');
    const matchingScar = brielleWinner.scars.find((s) => s.questId === 'quest-showcase-jwt');
    expect(matchingScar).toBeDefined();
  });

  it('scar records questId, monsterIdAtFatal, and occurredAt with correct shape', async () => {
    vi.mocked(getDefaultQuestAdapter).mockReturnValue(makeFailAdapter());

    const quest = parseQuest(db, 'quest-showcase-jwt');
    const brielle = parseAdventurer(db, 'adv-showcase-brielle');

    const { done } = await runQuest(quest, brielle, { db });
    await done;

    const brielleAfter = parseAdventurer(db, 'adv-showcase-brielle');
    const scarCount = brielleAfter.scars.length;
    expect(scarCount).toBeGreaterThan(0);

    const scar = brielleAfter.scars[scarCount - 1];
    expect(typeof scar.questId).toBe('string');
    expect(typeof scar.failureSummary).toBe('string');
    expect(scar.failureSummary.length).toBeGreaterThan(0);
    expect(typeof scar.monsterIdAtFatal).toBe('string');
    expect(scar.monsterIdAtFatal.length).toBeGreaterThan(0);
    expect(() => new Date(scar.occurredAt)).not.toThrow();
  });
});
