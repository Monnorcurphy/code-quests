import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({ default: vi.fn() }));
vi.mock('../agents/select-adapter', () => ({
  getQuestAdapter: vi.fn(),
  getAuditAdapter: vi.fn(),
}));

import Database from 'better-sqlite3';
import type { AgentEvent } from '@code-quests/shared';
import { QuestSchema, AdventurerSchema } from '@code-quests/shared';
import { openDb } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { runQuest, PROGRESS_EVENTS_PER_SCENE } from '../services/quest-runner';
import { getQuestAdapter } from '../agents/select-adapter';
import { offlineAdapter } from '../agents/offline-adapter';

function insertAdventurer(db: Database.Database, id: string) {
  db.prepare(
    `INSERT INTO adventurers (id, name, class, model_id) VALUES (?, ?, ?, ?)`,
  ).run(id, `Hero ${id}`, 'ranger', 'claude-haiku');
}

function insertQuest(db: Database.Database, id: string, advId: string, status = 'active') {
  db.prepare(
    `INSERT INTO quests (id, title, description, acceptance_criteria_json, edge_cases_json, status, adventurer_id, equipment_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    'Test Quest',
    'A long description that should be meaningful',
    JSON.stringify(['Task done', 'No regressions']),
    JSON.stringify(['Edge case 1']),
    status,
    advId,
    JSON.stringify({ skillIds: [], toolIds: [], mcpServerIds: [] }),
  );
}

function parseQuest(db: Database.Database, id: string) {
  const questRow = db.prepare('SELECT * FROM quests WHERE id = ?').get(id) as Record<string, unknown>;
  return QuestSchema.parse({
    id: questRow['id'],
    epicId: questRow['epic_id'] ?? null,
    title: questRow['title'],
    description: questRow['description'],
    acceptanceCriteria: JSON.parse(questRow['acceptance_criteria_json'] as string) as string[],
    edgeCases: JSON.parse(questRow['edge_cases_json'] as string) as string[],
    context: questRow['context'],
    status: questRow['status'],
    adventurerId: questRow['adventurer_id'] ?? null,
    agentId: questRow['agent_id'] ?? null,
    equipment: JSON.parse(questRow['equipment_json'] as string),
    specAudit: null,
    failureSummary: null,
    createdAt: questRow['created_at'],
    updatedAt: questRow['updated_at'],
  });
}

function parseAdventurer(db: Database.Database, id: string) {
  const advRow = db.prepare('SELECT * FROM adventurers WHERE id = ?').get(id) as Record<string, unknown>;
  return AdventurerSchema.parse({
    id: advRow['id'],
    name: advRow['name'],
    class: advRow['class'],
    modelId: advRow['model_id'],
    createdAt: advRow['created_at'],
    stats: JSON.parse(advRow['stats_json'] as string),
    specializations: JSON.parse(advRow['specializations_json'] as string),
    scars: JSON.parse(advRow['scars_json'] as string),
  });
}

describe('runQuest (offline adapter)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    vi.mocked(getQuestAdapter).mockReturnValue(offlineAdapter);
  });

  afterEach(() => {
    vi.clearAllMocks();
    db.close();
  });

  it('creates an agent row and transitions quest to complete', async () => {
    insertAdventurer(db, 'adv-1');
    insertQuest(db, 'q-1', 'adv-1');

    const questRow = db.prepare('SELECT * FROM quests WHERE id = ?').get('q-1') as Record<string, unknown>;
    const quest = QuestSchema.parse({
      id: questRow['id'],
      epicId: questRow['epic_id'] ?? null,
      title: questRow['title'],
      description: questRow['description'],
      acceptanceCriteria: JSON.parse(questRow['acceptance_criteria_json'] as string) as string[],
      edgeCases: JSON.parse(questRow['edge_cases_json'] as string) as string[],
      context: questRow['context'],
      status: questRow['status'],
      adventurerId: questRow['adventurer_id'] ?? null,
      agentId: questRow['agent_id'] ?? null,
      equipment: JSON.parse(questRow['equipment_json'] as string),
      specAudit: null,
      failureSummary: null,
      createdAt: questRow['created_at'],
      updatedAt: questRow['updated_at'],
    });

    const advRow = db.prepare('SELECT * FROM adventurers WHERE id = ?').get('adv-1') as Record<string, unknown>;
    const adventurer = AdventurerSchema.parse({
      id: advRow['id'],
      name: advRow['name'],
      class: advRow['class'],
      modelId: advRow['model_id'],
      createdAt: advRow['created_at'],
      stats: JSON.parse(advRow['stats_json'] as string),
      specializations: JSON.parse(advRow['specializations_json'] as string),
      scars: JSON.parse(advRow['scars_json'] as string),
    });

    const receivedEvents: AgentEvent[] = [];
    const { agent, done } = await runQuest(quest, adventurer, {
      db,
      publishEvent: (_questId, event) => { receivedEvents.push(event); },
    });

    expect(agent.id).toBeTruthy();
    expect(agent.adventurerId).toBe('adv-1');
    expect(agent.questId).toBe('q-1');
    expect(agent.endedAt).toBeNull();

    await done;

    expect(receivedEvents.length).toBeGreaterThan(0);
    const completedEvent = receivedEvents.find((e) => e.type === 'completed');
    expect(completedEvent).toBeDefined();

    const updatedQuest = db.prepare('SELECT status FROM quests WHERE id = ?').get('q-1') as { status: string };
    expect(updatedQuest.status).toBe('complete');

    const updatedAgent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agent.id) as {
      ended_at: string | null;
      exit_code: number | null;
    };
    expect(updatedAgent.ended_at).not.toBeNull();
    expect(updatedAgent.exit_code).toBe(0);
  });

  it('sets agent_id on the quest after spawn', async () => {
    insertAdventurer(db, 'adv-2');
    insertQuest(db, 'q-2', 'adv-2');

    const questRow = db.prepare('SELECT * FROM quests WHERE id = ?').get('q-2') as Record<string, unknown>;
    const quest = QuestSchema.parse({
      id: questRow['id'],
      epicId: null,
      title: questRow['title'] as string,
      description: questRow['description'] as string,
      acceptanceCriteria: JSON.parse(questRow['acceptance_criteria_json'] as string) as string[],
      edgeCases: JSON.parse(questRow['edge_cases_json'] as string) as string[],
      context: questRow['context'] as string,
      status: questRow['status'] as string,
      adventurerId: questRow['adventurer_id'] as string,
      agentId: null,
      equipment: JSON.parse(questRow['equipment_json'] as string),
      specAudit: null,
      failureSummary: null,
      createdAt: questRow['created_at'] as string,
      updatedAt: questRow['updated_at'] as string,
    });

    const advRow = db.prepare('SELECT * FROM adventurers WHERE id = ?').get('adv-2') as Record<string, unknown>;
    const adventurer = AdventurerSchema.parse({
      id: advRow['id'],
      name: advRow['name'],
      class: advRow['class'],
      modelId: advRow['model_id'],
      createdAt: advRow['created_at'],
      stats: JSON.parse(advRow['stats_json'] as string),
      specializations: JSON.parse(advRow['specializations_json'] as string),
      scars: JSON.parse(advRow['scars_json'] as string),
    });

    const { agent, done } = await runQuest(quest, adventurer, { db });
    await done;

    const questAfter = db.prepare('SELECT agent_id FROM quests WHERE id = ?').get('q-2') as { agent_id: string | null };
    expect(questAfter.agent_id).toBe(agent.id);
  });

  it('fires WS events for all offline adapter events', async () => {
    insertAdventurer(db, 'adv-3');
    insertQuest(db, 'q-3', 'adv-3');

    const questRow = db.prepare('SELECT * FROM quests WHERE id = ?').get('q-3') as Record<string, unknown>;
    const quest = QuestSchema.parse({
      id: questRow['id'],
      epicId: null,
      title: questRow['title'] as string,
      description: questRow['description'] as string,
      acceptanceCriteria: JSON.parse(questRow['acceptance_criteria_json'] as string) as string[],
      edgeCases: JSON.parse(questRow['edge_cases_json'] as string) as string[],
      context: questRow['context'] as string,
      status: questRow['status'] as string,
      adventurerId: questRow['adventurer_id'] as string,
      agentId: null,
      equipment: JSON.parse(questRow['equipment_json'] as string),
      specAudit: null,
      failureSummary: null,
      createdAt: questRow['created_at'] as string,
      updatedAt: questRow['updated_at'] as string,
    });

    const advRow = db.prepare('SELECT * FROM adventurers WHERE id = ?').get('adv-3') as Record<string, unknown>;
    const adventurer = AdventurerSchema.parse({
      id: advRow['id'],
      name: advRow['name'],
      class: advRow['class'],
      modelId: advRow['model_id'],
      createdAt: advRow['created_at'],
      stats: JSON.parse(advRow['stats_json'] as string),
      specializations: JSON.parse(advRow['specializations_json'] as string),
      scars: JSON.parse(advRow['scars_json'] as string),
    });

    const publishSpy = vi.fn();
    const { done } = await runQuest(quest, adventurer, { db, publishEvent: publishSpy });
    await done;

    expect(publishSpy).toHaveBeenCalled();
    const questIds = publishSpy.mock.calls.map((c: unknown[]) => c[0]);
    expect(questIds.every((id: unknown) => id === 'q-3')).toBe(true);
    const eventTypes = publishSpy.mock.calls.map((c: unknown[]) => (c[1] as AgentEvent).type);
    expect(eventTypes).toContain('completed');
  });
});

describe('runQuest error recovery (bug regression)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    vi.clearAllMocks();
    db.close();
  });

  it('transitions quest to failed and closes agent when event iterator throws', async () => {
    insertAdventurer(db, 'adv-err');
    insertQuest(db, 'q-err', 'adv-err');

    vi.mocked(getQuestAdapter).mockReturnValueOnce({
      name: 'mock-throw',
      async spawn() {
        return {
          pid: null,
          async *events(): AsyncGenerator<AgentEvent> {
            yield { type: 'progress', timestamp: new Date().toISOString(), message: 'Starting' };
            throw new Error('EPIPE: stream broke');
          },
          async cancel() {},
          async awaitExit() { return { exitCode: null }; },
        };
      },
    });

    const quest = parseQuest(db, 'q-err');
    const adventurer = parseAdventurer(db, 'adv-err');

    const { agent, done } = await runQuest(quest, adventurer, { db });
    await done;

    const questRow = db.prepare('SELECT status, failure_summary_json FROM quests WHERE id = ?').get('q-err') as {
      status: string;
      failure_summary_json: string | null;
    };
    expect(questRow.status).toBe('failed');
    expect(questRow.failure_summary_json).toBeTruthy();
    const summary = JSON.parse(questRow.failure_summary_json!) as { reason: string; recommendation: string };
    expect(summary.recommendation).toBe('retry');
    expect(summary.reason).toContain('EPIPE');

    const agentRow = db.prepare('SELECT ended_at, exit_code FROM agents WHERE id = ?').get(agent.id) as {
      ended_at: string | null;
      exit_code: number | null;
    };
    expect(agentRow.ended_at).not.toBeNull();
    expect(agentRow.exit_code).toBeNull();
  });

  it('does not overwrite cancel recommendation when failed event arrives after cancel wins the race', async () => {
    insertAdventurer(db, 'adv-race');
    insertQuest(db, 'q-race', 'adv-race');

    let releaseFailedEvent!: () => void;
    const waitForRelease = new Promise<void>((resolve) => {
      releaseFailedEvent = resolve;
    });

    vi.mocked(getQuestAdapter).mockReturnValueOnce({
      name: 'mock-race',
      async spawn() {
        return {
          pid: null,
          async *events(): AsyncGenerator<AgentEvent> {
            await waitForRelease;
            yield { type: 'failed', timestamp: new Date().toISOString(), reason: 'agent failed' };
          },
          async cancel() {},
          async awaitExit() { return { exitCode: null }; },
        };
      },
    });

    const quest = parseQuest(db, 'q-race');
    const adventurer = parseAdventurer(db, 'adv-race');

    const { done } = await runQuest(quest, adventurer, { db });

    // Simulate /cancel winning the race before the runner emits its failed event
    const cancelSummary = { reason: 'User cancelled', recommendation: 'retire' };
    db.prepare(
      "UPDATE quests SET status = 'failed', failure_summary_json = ?, updated_at = ? WHERE id = ? AND status = 'active'",
    ).run(JSON.stringify(cancelSummary), new Date().toISOString(), 'q-race');

    releaseFailedEvent();
    await done;

    const row = db.prepare('SELECT failure_summary_json FROM quests WHERE id = ?').get('q-race') as {
      failure_summary_json: string;
    };
    const summary = JSON.parse(row.failure_summary_json) as { recommendation: string; reason: string };
    expect(summary.recommendation).toBe('retire');
    expect(summary.reason).toBe('User cancelled');
  });
});

describe('runQuest scene progression heuristic', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    vi.clearAllMocks();
    db.close();
  });

  it(`emits scene_change after every ${PROGRESS_EVENTS_PER_SCENE} progress events`, async () => {
    insertAdventurer(db, 'adv-heuristic');
    insertQuest(db, 'q-heuristic', 'adv-heuristic');

    vi.mocked(getQuestAdapter).mockReturnValueOnce({
      name: 'mock-progress',
      async spawn() {
        return {
          pid: null,
          async *events(): AsyncGenerator<AgentEvent> {
            const ts = new Date().toISOString();
            // Emit exactly PROGRESS_EVENTS_PER_SCENE progress events to trigger one scene_change
            for (let i = 0; i < PROGRESS_EVENTS_PER_SCENE; i++) {
              yield { type: 'progress', timestamp: ts, message: `Step ${i + 1}` };
            }
            yield { type: 'completed', timestamp: ts };
          },
          async cancel() {},
          async awaitExit() { return { exitCode: 0 }; },
        };
      },
    });

    const quest = parseQuest(db, 'q-heuristic');
    const adventurer = parseAdventurer(db, 'adv-heuristic');
    const publishSpy = vi.fn();

    const { done } = await runQuest(quest, adventurer, { db, publishEvent: publishSpy });
    await done;

    const publishedEvents = publishSpy.mock.calls.map((c: unknown[]) => c[1] as AgentEvent);
    const sceneChangeEvents = publishedEvents.filter((e) => e.type === 'scene_change');

    // First scene_change from the heuristic (3 progress events → forest→cave)
    const firstHeuristicChange = sceneChangeEvents[0];
    expect(firstHeuristicChange).toBeDefined();
    expect(firstHeuristicChange.type).toBe('scene_change');
    if (firstHeuristicChange.type === 'scene_change') {
      expect(firstHeuristicChange.from).toBe('quest-forest');
      expect(firstHeuristicChange.to).toBe('quest-cave');
    }
  });

  it('does not emit scene_change before the Nth progress event', async () => {
    insertAdventurer(db, 'adv-nodelay');
    insertQuest(db, 'q-nodelay', 'adv-nodelay');

    vi.mocked(getQuestAdapter).mockReturnValueOnce({
      name: 'mock-early',
      async spawn() {
        return {
          pid: null,
          async *events(): AsyncGenerator<AgentEvent> {
            const ts = new Date().toISOString();
            // Only 2 progress events — not enough to trigger heuristic (N=3)
            yield { type: 'progress', timestamp: ts, message: 'Step 1' };
            yield { type: 'progress', timestamp: ts, message: 'Step 2' };
            yield { type: 'completed', timestamp: ts };
          },
          async cancel() {},
          async awaitExit() { return { exitCode: 0 }; },
        };
      },
    });

    const quest = parseQuest(db, 'q-nodelay');
    const adventurer = parseAdventurer(db, 'adv-nodelay');
    const publishSpy = vi.fn();

    const { done } = await runQuest(quest, adventurer, { db, publishEvent: publishSpy });
    await done;

    const publishedEvents = publishSpy.mock.calls.map((c: unknown[]) => c[1] as AgentEvent);
    // Heuristic did NOT fire (only 2 progress events, need 3)
    const heuristicSceneChanges = publishedEvents.filter(
      (e) => e.type === 'scene_change' &&
             publishedEvents.findIndex((x) => x === e) <
             publishedEvents.findIndex((x) => x.type === 'completed'),
    );
    expect(heuristicSceneChanges).toHaveLength(0);
  });

  it('advances to quest-boss-room on completed event regardless of current scene', async () => {
    insertAdventurer(db, 'adv-complete');
    insertQuest(db, 'q-complete', 'adv-complete'); // starts at quest-forest

    vi.mocked(getQuestAdapter).mockReturnValueOnce({
      name: 'mock-complete',
      async spawn() {
        return {
          pid: null,
          async *events(): AsyncGenerator<AgentEvent> {
            // Only 1 progress event — stays at forest (not enough for heuristic)
            yield { type: 'progress', timestamp: new Date().toISOString(), message: 'Starting' };
            yield { type: 'completed', timestamp: new Date().toISOString() };
          },
          async cancel() {},
          async awaitExit() { return { exitCode: 0 }; },
        };
      },
    });

    const quest = parseQuest(db, 'q-complete');
    const adventurer = parseAdventurer(db, 'adv-complete');
    const publishSpy = vi.fn();

    const { done } = await runQuest(quest, adventurer, { db, publishEvent: publishSpy });
    await done;

    // DB state must be boss-room
    const questRow = db.prepare('SELECT current_scene FROM quests WHERE id = ?').get('q-complete') as {
      current_scene: string;
    };
    expect(questRow.current_scene).toBe('quest-boss-room');

    // scene_change events must have been emitted
    const publishedEvents = publishSpy.mock.calls.map((c: unknown[]) => c[1] as AgentEvent);
    const sceneChangeEvents = publishedEvents.filter((e) => e.type === 'scene_change');
    expect(sceneChangeEvents.length).toBeGreaterThan(0);

    // Last scene_change must end at boss-room
    const last = sceneChangeEvents[sceneChangeEvents.length - 1];
    if (last.type === 'scene_change') {
      expect(last.to).toBe('quest-boss-room');
    }
  });

  it('does not double-emit scene_change when already at boss-room on completed', async () => {
    insertAdventurer(db, 'adv-atboss');
    // Insert quest already at boss-room
    insertQuest(db, 'q-atboss', 'adv-atboss');
    db.prepare("UPDATE quests SET current_scene = 'quest-boss-room' WHERE id = ?").run('q-atboss');

    vi.mocked(getQuestAdapter).mockReturnValueOnce({
      name: 'mock-atboss',
      async spawn() {
        return {
          pid: null,
          async *events(): AsyncGenerator<AgentEvent> {
            yield { type: 'completed', timestamp: new Date().toISOString() };
          },
          async cancel() {},
          async awaitExit() { return { exitCode: 0 }; },
        };
      },
    });

    const quest = parseQuest(db, 'q-atboss');
    const adventurer = parseAdventurer(db, 'adv-atboss');
    const publishSpy = vi.fn();

    const { done } = await runQuest(quest, adventurer, { db, publishEvent: publishSpy });
    await done;

    const publishedEvents = publishSpy.mock.calls.map((c: unknown[]) => c[1] as AgentEvent);
    const sceneChangeEvents = publishedEvents.filter((e) => e.type === 'scene_change');
    // Already at boss-room — no scene_change needed
    expect(sceneChangeEvents).toHaveLength(0);
  });
});
