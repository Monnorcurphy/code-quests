import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({ default: vi.fn() }));
vi.mock('../agents/select-adapter', () => ({
  getQuestAdapter: vi.fn(),
  getDefaultQuestAdapter: vi.fn(),
  getAdapterForModel: vi.fn(),
  getAuditAdapter: vi.fn(),
}));

import Database from 'better-sqlite3';
import type { AgentEvent } from '@code-quests/shared';
import { QuestSchema, AdventurerSchema } from '@code-quests/shared';
import { openDb } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { runQuest, PROGRESS_EVENTS_PER_SCENE, LICH_REPEAT_THRESHOLD, getActiveHandle } from '../services/quest-runner';
import { getDefaultQuestAdapter } from '../agents/select-adapter';
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
    vi.mocked(getDefaultQuestAdapter).mockReturnValue(offlineAdapter);
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
      publishEvent: (questId, event) => {
        receivedEvents.push(event);
        if (event.type === 'paused_input') {
          void getActiveHandle(questId)?.respond('test response');
        }
      },
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
    projectId: null,
    modelId: null,
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

    const { agent, done } = await runQuest(quest, adventurer, {
      db,
      publishEvent: (questId, event) => {
        if (event.type === 'paused_input') {
          void getActiveHandle(questId)?.respond('test response');
        }
      },
    });
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
    projectId: null,
    modelId: null,
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

    const publishSpy = vi.fn((questId: string, event: AgentEvent) => {
      if (event.type === 'paused_input') {
        void getActiveHandle(questId)?.respond('test response');
      }
    });
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

  it('transitions quest to returned_to_town (via failure detector) and closes agent when event iterator throws', async () => {
    insertAdventurer(db, 'adv-err');
    insertQuest(db, 'q-err', 'adv-err');

    vi.mocked(getDefaultQuestAdapter).mockReturnValueOnce({
      name: 'mock-throw',
      async spawn() {
        return {
          pid: null,
          async *events(): AsyncGenerator<AgentEvent> {
            yield { type: 'progress', timestamp: new Date().toISOString(), message: 'Starting' };
            throw new Error('EPIPE: stream broke');
          },
          async cancel() {},
          async respond() {},
          async awaitExit() { return { exitCode: null }; },
        };
      },
    });

    const quest = parseQuest(db, 'q-err');
    const adventurer = parseAdventurer(db, 'adv-err');

    const { agent, done } = await runQuest(quest, adventurer, { db });
    await done;

    // Phase 9: failure-detector automatically transitions failed → returned_to_town
    const questRow = db.prepare('SELECT status, failure_summary_json FROM quests WHERE id = ?').get('q-err') as {
      status: string;
      failure_summary_json: string | null;
    };
    expect(questRow.status).toBe('returned_to_town');
    expect(questRow.failure_summary_json).toBeTruthy();
    const summary = JSON.parse(questRow.failure_summary_json!) as { recommendation: string };
    expect(summary.recommendation).toBeTruthy();

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

    vi.mocked(getDefaultQuestAdapter).mockReturnValueOnce({
      name: 'mock-race',
      async spawn() {
        return {
          pid: null,
          async *events(): AsyncGenerator<AgentEvent> {
            await waitForRelease;
            yield { type: 'failed', timestamp: new Date().toISOString(), reason: 'agent failed' };
          },
          async cancel() {},
          async respond() {},
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

    vi.mocked(getDefaultQuestAdapter).mockReturnValueOnce({
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
          async respond() {},
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

    vi.mocked(getDefaultQuestAdapter).mockReturnValueOnce({
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
          async respond() {},
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

    vi.mocked(getDefaultQuestAdapter).mockReturnValueOnce({
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
          async respond() {},
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

  it('persists scene_change events to agents.events_json', async () => {
    insertAdventurer(db, 'adv-persist');
    insertQuest(db, 'q-persist', 'adv-persist');

    vi.mocked(getDefaultQuestAdapter).mockReturnValueOnce({
      name: 'mock-persist',
      async spawn() {
        return {
          pid: null,
          async *events(): AsyncGenerator<AgentEvent> {
            const ts = new Date().toISOString();
            // Emit exactly PROGRESS_EVENTS_PER_SCENE progress events → triggers one heuristic scene_change
            for (let i = 0; i < PROGRESS_EVENTS_PER_SCENE; i++) {
              yield { type: 'progress', timestamp: ts, message: `Step ${i + 1}` };
            }
            yield { type: 'completed', timestamp: ts };
          },
          async cancel() {},
          async respond() {},
          async awaitExit() { return { exitCode: 0 }; },
        };
      },
    });

    const quest = parseQuest(db, 'q-persist');
    const adventurer = parseAdventurer(db, 'adv-persist');

    const { agent, done } = await runQuest(quest, adventurer, { db });
    await done;

    const agentRow = db.prepare('SELECT events_json FROM agents WHERE id = ?').get(agent.id) as {
      events_json: string | null;
    };
    expect(agentRow.events_json).toBeTruthy();
    const events = JSON.parse(agentRow.events_json!) as AgentEvent[];

    const sceneChangeEvents = events.filter((e) => e.type === 'scene_change');
    expect(sceneChangeEvents.length).toBeGreaterThan(0);

    // Heuristic scene_change: forest → cave
    const heuristicChange = sceneChangeEvents[0];
    expect(heuristicChange.type).toBe('scene_change');
    if (heuristicChange.type === 'scene_change') {
      expect(heuristicChange.from).toBe('quest-forest');
      expect(heuristicChange.to).toBe('quest-cave');
    }

    // Completion-driven scene_changes must include the terminal one ending at boss-room
    const lastChange = sceneChangeEvents[sceneChangeEvents.length - 1];
    expect(lastChange.type).toBe('scene_change');
    if (lastChange.type === 'scene_change') {
      expect(lastChange.to).toBe('quest-boss-room');
    }
  });

  it('does not double-emit scene_change when already at boss-room on completed', async () => {
    insertAdventurer(db, 'adv-atboss');
    // Insert quest already at boss-room
    insertQuest(db, 'q-atboss', 'adv-atboss');
    db.prepare("UPDATE quests SET current_scene = 'quest-boss-room' WHERE id = ?").run('q-atboss');

    vi.mocked(getDefaultQuestAdapter).mockReturnValueOnce({
      name: 'mock-atboss',
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

describe('runQuest combat/encounter integration', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    vi.clearAllMocks();
    db.close();
  });

  it('publishes monster_appeared before combat and resolves all encounters as victory on completed', async () => {
    insertAdventurer(db, 'adv-vic');
    insertQuest(db, 'q-vic', 'adv-vic');

    vi.mocked(getDefaultQuestAdapter).mockReturnValueOnce({
      name: 'mock-victory',
      async spawn() {
        return {
          pid: null,
          async *events(): AsyncGenerator<AgentEvent> {
            const ts = new Date().toISOString();
            yield { type: 'progress', timestamp: ts, message: 'Starting' };
            yield { type: 'combat', timestamp: ts, message: 'lint error: no-console violation' };
            yield { type: 'combat', timestamp: ts, message: 'typescript error: type mismatch' };
            yield { type: 'completed', timestamp: ts };
          },
          async cancel() {},
          async respond() {},
          async awaitExit() { return { exitCode: 0 }; },
        };
      },
    });

    const quest = parseQuest(db, 'q-vic');
    const adventurer = parseAdventurer(db, 'adv-vic');
    const publishSpy = vi.fn();

    const { done } = await runQuest(quest, adventurer, { db, publishEvent: publishSpy });
    await done;

    const published = publishSpy.mock.calls.map((c: unknown[]) => c[1] as AgentEvent);
    const types = published.map((e) => e.type);

    // monster_appeared must precede its corresponding combat event
    const firstAppearedIdx = types.indexOf('monster_appeared');
    const firstCombatIdx = types.indexOf('combat');
    expect(firstAppearedIdx).toBeGreaterThanOrEqual(0);
    expect(firstAppearedIdx).toBeLessThan(firstCombatIdx);

    // Two monster_appeared events (one per combat)
    expect(published.filter((e) => e.type === 'monster_appeared')).toHaveLength(2);

    // Two monster_resolved events, both victory, all published after completed
    const resolvedEvents = published.filter((e) => e.type === 'monster_resolved');
    expect(resolvedEvents).toHaveLength(2);
    for (const e of resolvedEvents) {
      if (e.type === 'monster_resolved') expect(e.outcome).toBe('victory');
    }
    const completedIdx = types.indexOf('completed');
    const resolvedIndices = types.map((t, i) => (t === 'monster_resolved' ? i : -1)).filter((i) => i >= 0);
    for (const idx of resolvedIndices) {
      expect(idx).toBeGreaterThan(completedIdx);
    }

    // DB: both encounters have outcome victory
    const encounters = db
      .prepare("SELECT outcome FROM monster_encounters WHERE quest_id = ?")
      .all('q-vic') as { outcome: string }[];
    expect(encounters).toHaveLength(2);
    for (const enc of encounters) {
      expect(enc.outcome).toBe('victory');
    }
  });

  it('resolves last encounter as defeat and earlier encounters as escape on failed', async () => {
    insertAdventurer(db, 'adv-def');
    insertQuest(db, 'q-def', 'adv-def');

    vi.mocked(getDefaultQuestAdapter).mockReturnValueOnce({
      name: 'mock-defeat',
      async spawn() {
        return {
          pid: null,
          async *events(): AsyncGenerator<AgentEvent> {
            const ts = new Date().toISOString();
            yield { type: 'progress', timestamp: ts, message: 'Starting' };
            yield { type: 'combat', timestamp: ts, message: 'lint error: no-console' };
            yield { type: 'combat', timestamp: ts, message: 'typescript error: type error' };
            yield { type: 'failed', timestamp: ts, reason: 'could not fix errors' };
          },
          async cancel() {},
          async respond() {},
          async awaitExit() { return { exitCode: 1 }; },
        };
      },
    });

    const quest = parseQuest(db, 'q-def');
    const adventurer = parseAdventurer(db, 'adv-def');
    const publishSpy = vi.fn();

    const { done } = await runQuest(quest, adventurer, { db, publishEvent: publishSpy });
    await done;

    const published = publishSpy.mock.calls.map((c: unknown[]) => c[1] as AgentEvent);
    const types = published.map((e) => e.type);

    // Two monster_resolved events published after the failed event
    const resolvedEvents = published.filter((e) => e.type === 'monster_resolved');
    expect(resolvedEvents).toHaveLength(2);

    const failedIdx = types.indexOf('failed');
    const resolvedIndices = types.map((t, i) => (t === 'monster_resolved' ? i : -1)).filter((i) => i >= 0);
    for (const idx of resolvedIndices) {
      expect(idx).toBeGreaterThan(failedIdx);
    }

    // First encounter: escape; last encounter: defeat
    const [first, last] = resolvedEvents;
    if (first.type === 'monster_resolved') expect(first.outcome).toBe('escape');
    if (last.type === 'monster_resolved') expect(last.outcome).toBe('defeat');

    // DB reflects the same outcome ordering
    const encounters = db
      .prepare("SELECT outcome FROM monster_encounters WHERE quest_id = ? ORDER BY appeared_at ASC")
      .all('q-def') as { outcome: string }[];
    expect(encounters).toHaveLength(2);
    expect(encounters[0].outcome).toBe('escape');
    expect(encounters[1].outcome).toBe('defeat');
  });

  it('clears pending encounters after resolution so a second quest run starts clean', async () => {
    insertAdventurer(db, 'adv-clear');
    insertQuest(db, 'q-clear-a', 'adv-clear');
    insertQuest(db, 'q-clear-b', 'adv-clear');

    const ts = new Date().toISOString();

    // First quest: one combat then completed
    vi.mocked(getDefaultQuestAdapter).mockReturnValueOnce({
      name: 'mock-clear-a',
      async spawn() {
        return {
          pid: null,
          async *events(): AsyncGenerator<AgentEvent> {
            yield { type: 'combat', timestamp: ts, message: 'lint error' };
            yield { type: 'completed', timestamp: ts };
          },
          async cancel() {},
          async respond() {},
          async awaitExit() { return { exitCode: 0 }; },
        };
      },
    });

    const questA = parseQuest(db, 'q-clear-a');
    const adventurer = parseAdventurer(db, 'adv-clear');
    const { done: doneA } = await runQuest(questA, adventurer, { db });
    await doneA;

    // Second quest: no combat, just completed — should emit zero monster_resolved events
    db.prepare("UPDATE quests SET status = 'active' WHERE id = ?").run('q-clear-b');

    vi.mocked(getDefaultQuestAdapter).mockReturnValueOnce({
      name: 'mock-clear-b',
      async spawn() {
        return {
          pid: null,
          async *events(): AsyncGenerator<AgentEvent> {
            yield { type: 'completed', timestamp: ts };
          },
          async cancel() {},
          async respond() {},
          async awaitExit() { return { exitCode: 0 }; },
        };
      },
    });

    const questB = parseQuest(db, 'q-clear-b');
    const spyB = vi.fn();
    const { done: doneB } = await runQuest(questB, adventurer, { db, publishEvent: spyB });
    await doneB;

    const eventsB = spyB.mock.calls.map((c: unknown[]) => c[1] as AgentEvent);
    expect(eventsB.filter((e) => e.type === 'monster_resolved')).toHaveLength(0);
  });
});

describe('runQuest lich aggregator', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    vi.clearAllMocks();
    db.close();
  });

  it(`spawns a lich after ${LICH_REPEAT_THRESHOLD} same-type encounters in one quest`, async () => {
    insertAdventurer(db, 'adv-lich');
    insertQuest(db, 'q-lich', 'adv-lich');

    // Emit LICH_REPEAT_THRESHOLD combat events with imp_typecheck type
    const ts = new Date().toISOString();
    const impMsg = 'TS2345: type error found';

    vi.mocked(getDefaultQuestAdapter).mockReturnValueOnce({
      name: 'mock-lich',
      async spawn() {
        return {
          pid: null,
          async *events(): AsyncGenerator<AgentEvent> {
            for (let i = 0; i < LICH_REPEAT_THRESHOLD; i++) {
              yield {
                type: 'combat',
                timestamp: ts,
                monsterTypeId: 'imp_typecheck',
                message: impMsg,
              };
            }
            yield { type: 'completed', timestamp: ts };
          },
          async cancel() {},
          async respond() {},
          async awaitExit() { return { exitCode: 0 }; },
        };
      },
    });

    const quest = parseQuest(db, 'q-lich');
    const adventurer = parseAdventurer(db, 'adv-lich');
    const publishSpy = vi.fn();

    const { done } = await runQuest(quest, adventurer, { db, publishEvent: publishSpy });
    await done;

    const published = publishSpy.mock.calls.map((c: unknown[]) => c[1] as AgentEvent);

    // Should have LICH_REPEAT_THRESHOLD imp appeared events + 1 lich appeared
    const appearedEvents = published.filter((e) => e.type === 'monster_appeared');
    expect(appearedEvents.length).toBe(LICH_REPEAT_THRESHOLD + 1);

    // Last appeared should be the lich
    const lichAppeared = appearedEvents[appearedEvents.length - 1];
    expect(lichAppeared.type).toBe('monster_appeared');
    if (lichAppeared.type === 'monster_appeared') {
      expect(lichAppeared.monsterTypeId).toBe('lich_repeated_failure');
    }

    // DB should have a lich encounter record for this quest
    const lichEncounter = db
      .prepare(
        "SELECT me.* FROM monster_encounters me JOIN monsters m ON me.monster_id = m.id WHERE me.quest_id = ? AND m.type_id = 'lich_repeated_failure'",
      )
      .get('q-lich');
    expect(lichEncounter).toBeDefined();
  });

  it(`spawns one lich per distinct type that hits ${LICH_REPEAT_THRESHOLD} encounters`, async () => {
    insertAdventurer(db, 'adv-two-lich');
    insertQuest(db, 'q-two-lich', 'adv-two-lich');

    const ts = new Date().toISOString();

    vi.mocked(getDefaultQuestAdapter).mockReturnValueOnce({
      name: 'mock-two-lich',
      async spawn() {
        return {
          pid: null,
          async *events(): AsyncGenerator<AgentEvent> {
            // 3 imps + 3 goblins — two liches should appear
            for (let i = 0; i < LICH_REPEAT_THRESHOLD; i++) {
              yield { type: 'combat', timestamp: ts, monsterTypeId: 'imp_typecheck', message: 'typescript error' };
            }
            for (let i = 0; i < LICH_REPEAT_THRESHOLD; i++) {
              yield { type: 'combat', timestamp: ts, monsterTypeId: 'goblin_linter', message: 'eslint error' };
            }
            yield { type: 'completed', timestamp: ts };
          },
          async cancel() {},
          async respond() {},
          async awaitExit() { return { exitCode: 0 }; },
        };
      },
    });

    const quest = parseQuest(db, 'q-two-lich');
    const adventurer = parseAdventurer(db, 'adv-two-lich');
    const publishSpy = vi.fn();

    const { done } = await runQuest(quest, adventurer, { db, publishEvent: publishSpy });
    await done;

    const published = publishSpy.mock.calls.map((c: unknown[]) => c[1] as AgentEvent);
    const lichAppearedEvents = published.filter(
      (e) => e.type === 'monster_appeared' && e.type === 'monster_appeared'
        && (e as { monsterTypeId?: string }).monsterTypeId === 'lich_repeated_failure',
    );
    // Each distinct type hitting threshold spawns one lich
    expect(lichAppearedEvents.length).toBe(2);
  });

  it('does not spawn lich for fewer than threshold same-type encounters', async () => {
    insertAdventurer(db, 'adv-no-lich');
    insertQuest(db, 'q-no-lich', 'adv-no-lich');

    const ts = new Date().toISOString();

    vi.mocked(getDefaultQuestAdapter).mockReturnValueOnce({
      name: 'mock-no-lich',
      async spawn() {
        return {
          pid: null,
          async *events(): AsyncGenerator<AgentEvent> {
            // Only LICH_REPEAT_THRESHOLD - 1 encounters — no lich
            for (let i = 0; i < LICH_REPEAT_THRESHOLD - 1; i++) {
              yield { type: 'combat', timestamp: ts, monsterTypeId: 'imp_typecheck', message: 'typescript error' };
            }
            yield { type: 'completed', timestamp: ts };
          },
          async cancel() {},
          async respond() {},
          async awaitExit() { return { exitCode: 0 }; },
        };
      },
    });

    const quest = parseQuest(db, 'q-no-lich');
    const adventurer = parseAdventurer(db, 'adv-no-lich');
    const publishSpy = vi.fn();

    const { done } = await runQuest(quest, adventurer, { db, publishEvent: publishSpy });
    await done;

    const published = publishSpy.mock.calls.map((c: unknown[]) => c[1] as AgentEvent);
    const lichAppearedEvents = published.filter(
      (e) => e.type === 'monster_appeared'
        && (e as { monsterTypeId?: string }).monsterTypeId === 'lich_repeated_failure',
    );
    expect(lichAppearedEvents).toHaveLength(0);
  });
});

describe('runQuest paused_input / resumed handling', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    vi.clearAllMocks();
    db.close();
  });

  it('transitions quest to paused_input and sets input_request_json on paused_input event', async () => {
    insertAdventurer(db, 'adv-pause');
    insertQuest(db, 'q-pause', 'adv-pause');

    vi.mocked(getDefaultQuestAdapter).mockReturnValueOnce({
      name: 'mock-pause',
      async spawn() {
        let resolveRespond!: (text: string) => void;
        const respondPromise = new Promise<string>((res) => { resolveRespond = res; });
        return {
          pid: null,
          async *events(): AsyncGenerator<AgentEvent> {
            const ts = new Date().toISOString();
            yield { type: 'progress', timestamp: ts, message: 'Starting' };
            yield { type: 'paused_input', timestamp: ts, question: 'Which approach?' };
            await respondPromise;
            yield { type: 'resumed', timestamp: ts, source: 'input_response' };
            yield { type: 'completed', timestamp: ts };
          },
          async cancel() {},
          async respond(text: string) { resolveRespond(text); },
          async awaitExit() { return { exitCode: 0 }; },
        };
      },
    });

    const quest = parseQuest(db, 'q-pause');
    const adventurer = parseAdventurer(db, 'adv-pause');

    const publishedEvents: AgentEvent[] = [];
    const { done } = await runQuest(quest, adventurer, {
      db,
      publishEvent: (questId, event) => {
        publishedEvents.push(event);
        if (event.type === 'paused_input') {
          void getActiveHandle(questId)?.respond('use approach A');
        }
      },
    });

    await done;

    const finalRow = db.prepare('SELECT status FROM quests WHERE id = ?').get('q-pause') as { status: string };
    expect(finalRow.status).toBe('complete');

    const types = publishedEvents.map((e) => e.type);
    expect(types).toContain('paused_input');
    expect(types).toContain('resumed');
    expect(types).toContain('status_change');
  });

  it('populates input_request_json when paused_input event arrives', async () => {
    insertAdventurer(db, 'adv-irq');
    insertQuest(db, 'q-irq', 'adv-irq');

    let resolveRespond!: (text: string) => void;
    const respondPromise = new Promise<string>((res) => { resolveRespond = res; });
    let pausedInputPublished = false;

    vi.mocked(getDefaultQuestAdapter).mockReturnValueOnce({
      name: 'mock-irq',
      async spawn() {
        return {
          pid: null,
          async *events(): AsyncGenerator<AgentEvent> {
            const ts = new Date().toISOString();
            yield { type: 'paused_input', timestamp: ts, question: 'Need API key?', context: 'Missing env var' };
            await respondPromise;
            yield { type: 'resumed', timestamp: ts, source: 'input_response' };
            yield { type: 'completed', timestamp: ts };
          },
          async cancel() {},
          async respond(text: string) { resolveRespond(text); },
          async awaitExit() { return { exitCode: 0 }; },
        };
      },
    });

    const quest = parseQuest(db, 'q-irq');
    const adventurer = parseAdventurer(db, 'adv-irq');

    const { done } = await runQuest(quest, adventurer, {
      db,
      publishEvent: (questId, event) => {
        if (event.type === 'paused_input' && !pausedInputPublished) {
          pausedInputPublished = true;
          // Check DB immediately after publish
          const row = db.prepare('SELECT status, input_request_json FROM quests WHERE id = ?').get(questId) as {
            status: string;
            input_request_json: string | null;
          };
          expect(row.status).toBe('paused_input');
          expect(row.input_request_json).not.toBeNull();
          const parsed = JSON.parse(row.input_request_json!) as { question: string; context?: string };
          expect(parsed.question).toBe('Need API key?');
          expect(parsed.context).toBe('Missing env var');
          // Respond
          resolveRespond('yes, set API_KEY=test');
        }
      },
    });

    await done;
  });

  it('persists resumed event to agents.events_json immediately (before completed arrives)', async () => {
    insertAdventurer(db, 'adv-resume-persist');
    insertQuest(db, 'q-resume-persist', 'adv-resume-persist');

    let resolveRespond!: (text: string) => void;
    const respondPromise = new Promise<string>((res) => { resolveRespond = res; });
    // resolveComplete is called inside publishEvent once we have verified the DB state;
    // it gates the generator so that 'completed' cannot fire before we checked.
    let resolveComplete!: () => void;
    const completePromise = new Promise<void>((res) => { resolveComplete = res; });
    let resumedEventsSnapshot: AgentEvent[] | null = null;

    vi.mocked(getDefaultQuestAdapter).mockReturnValueOnce({
      name: 'mock-resume-persist',
      async spawn() {
        return {
          pid: null,
          async *events(): AsyncGenerator<AgentEvent> {
            const ts = new Date().toISOString();
            yield { type: 'paused_input', timestamp: ts, question: 'Which approach?' };
            await respondPromise;
            yield { type: 'resumed', timestamp: ts, source: 'input_response' };
            await completePromise;
            yield { type: 'completed', timestamp: ts };
          },
          async cancel() {},
          async respond(text: string) { resolveRespond(text); },
          async awaitExit() { return { exitCode: 0 }; },
        };
      },
    });

    const quest = parseQuest(db, 'q-resume-persist');
    const adventurer = parseAdventurer(db, 'adv-resume-persist');

    const { agent, done } = await runQuest(quest, adventurer, {
      db,
      publishEvent: (questId, event) => {
        if (event.type === 'paused_input') {
          void getActiveHandle(questId)?.respond('use approach A');
        }
        if (event.type === 'resumed') {
          // persistEvents() was called BEFORE publishEvent in the resumed branch,
          // so events_json already has the resumed event at this point.
          const agentRow = db.prepare('SELECT events_json FROM agents WHERE id = ?')
            .get(agent.id) as { events_json: string | null };
          if (agentRow?.events_json) {
            resumedEventsSnapshot = JSON.parse(agentRow.events_json) as AgentEvent[];
          }
          resolveComplete();
        }
      },
    });

    await done;

    // Snapshot was captured inside publishEvent for 'resumed', BEFORE 'completed' arrived.
    expect(resumedEventsSnapshot).not.toBeNull();
    expect(resumedEventsSnapshot!.some((e) => e.type === 'resumed')).toBe(true);

    const finalRow = db.prepare('SELECT status FROM quests WHERE id = ?').get('q-resume-persist') as { status: string };
    expect(finalRow.status).toBe('complete');
  });

  it('cancel during paused_input ends the quest cleanly', async () => {
    insertAdventurer(db, 'adv-cancel-pause');
    insertQuest(db, 'q-cancel-pause', 'adv-cancel-pause');

    let resolveRespond!: (text: string) => void;
    const respondPromise = new Promise<string>((res) => { resolveRespond = res; });
    let settled = false;

    vi.mocked(getDefaultQuestAdapter).mockReturnValueOnce({
      name: 'mock-cancel-pause',
      async spawn() {
        return {
          pid: null,
          async *events(): AsyncGenerator<AgentEvent> {
            const ts = new Date().toISOString();
            yield { type: 'paused_input', timestamp: ts, question: 'Waiting...' };
            await respondPromise;
            if (settled) return;
            yield { type: 'completed', timestamp: ts };
          },
          async cancel() {
            settled = true;
            resolveRespond('__cancel__');
          },
          async respond(text: string) { resolveRespond(text); },
          async awaitExit() { return { exitCode: null }; },
        };
      },
    });

    const quest = parseQuest(db, 'q-cancel-pause');
    const adventurer = parseAdventurer(db, 'adv-cancel-pause');

    const { done } = await runQuest(quest, adventurer, {
      db,
      publishEvent: (questId, event) => {
        if (event.type === 'paused_input') {
          // Simulate cancel instead of respond
          const handle = getActiveHandle(questId);
          void handle?.cancel('user cancelled');
          // Also update DB to failed as cancel route would do
          const ts = new Date().toISOString();
          db.prepare(
            "UPDATE quests SET status = 'failed', failure_summary_json = ?, updated_at = ? WHERE id = ? AND status = 'paused_input'",
          ).run(JSON.stringify({ reason: 'User cancelled', recommendation: 'retire' }), ts, questId);
        }
      },
    });

    await done;

    const row = db.prepare('SELECT status FROM quests WHERE id = ?').get('q-cancel-pause') as { status: string };
    expect(['failed', 'paused_input']).toContain(row.status);
  });
});

describe('runQuest adventure framing integration', () => {
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

  it('publishes a follow-up paused_input event with adventureFraming after framing completes', async () => {
    insertAdventurer(db, 'adv-frame');
    insertQuest(db, 'q-frame', 'adv-frame');

    const quest = parseQuest(db, 'q-frame');
    const adventurer = parseAdventurer(db, 'adv-frame');

    let resolveFramingReceived!: () => void;
    const framingReceived = new Promise<void>((res) => { resolveFramingReceived = res; });
    let capturedFraming: string | undefined;
    let capturedDbJson: string | null = null;

    const { done } = await runQuest(quest, adventurer, {
      db,
      publishEvent: (questId, event) => {
        if (event.type === 'paused_input') {
          if (event.adventureFraming) {
            // Follow-up event with framing — capture data, then respond so quest can proceed
            capturedFraming = event.adventureFraming;
            const row = db.prepare('SELECT input_request_json FROM quests WHERE id = ?').get(questId) as {
              input_request_json: string | null;
            };
            capturedDbJson = row.input_request_json;
            resolveFramingReceived();
            void getActiveHandle(questId)?.respond('test response');
          }
          // Do NOT respond on the first paused_input (no framing) — wait for framing first
        }
      },
    });

    await Promise.all([done, framingReceived]);

    // Framing event was published
    expect(capturedFraming).toBeDefined();
    // Fallback framing contains adventurer name
    expect(capturedFraming).toContain('Hero adv-frame');
    // DB was updated with adventureFraming at the time the event was published
    expect(capturedDbJson).not.toBeNull();
    const parsed = JSON.parse(capturedDbJson!) as { adventureFraming?: string };
    expect(parsed.adventureFraming).toBe(capturedFraming);
  });

  it('first paused_input event has no adventureFraming (non-blocking)', async () => {
    insertAdventurer(db, 'adv-frame-nb');
    insertQuest(db, 'q-frame-nb', 'adv-frame-nb');

    const quest = parseQuest(db, 'q-frame-nb');
    const adventurer = parseAdventurer(db, 'adv-frame-nb');

    let firstPausedInputHadFraming = true;

    const { done } = await runQuest(quest, adventurer, {
      db,
      publishEvent: (questId, event) => {
        if (event.type === 'paused_input' && !event.adventureFraming) {
          firstPausedInputHadFraming = false;
          void getActiveHandle(questId)?.respond('test response');
        }
      },
    });

    await done;

    // The immediate paused_input event must NOT have adventureFraming
    expect(firstPausedInputHadFraming).toBe(false);
  });

  it('does not publish framing event or corrupt DB when agent responds before framing resolves', async () => {
    insertAdventurer(db, 'adv-frame-race');
    insertQuest(db, 'q-frame-race', 'adv-frame-race');

    const quest = parseQuest(db, 'q-frame-race');
    const adventurer = parseAdventurer(db, 'adv-frame-race');

    let spuriousFramingAfterResumed = false;
    let resumedSeen = false;

    const { done } = await runQuest(quest, adventurer, {
      db,
      publishEvent: (questId, event) => {
        if (event.type === 'paused_input' && !event.adventureFraming) {
          // Respond immediately — simulate the race: user answers before framing resolves
          void getActiveHandle(questId)?.respond('fast response');
        }
        if (event.type === 'resumed') {
          resumedSeen = true;
        }
        if (event.type === 'paused_input' && event.adventureFraming && resumedSeen) {
          // Framing event published AFTER resumed — this is the stale-write bug
          spuriousFramingAfterResumed = true;
        }
      },
    });

    await done;

    // No spurious framing event published after resumed
    expect(spuriousFramingAfterResumed).toBe(false);
    // DB must be NULL — cleared by resumed and NOT overwritten by stale framing
    const row = db.prepare('SELECT input_request_json FROM quests WHERE id = ?').get('q-frame-race') as {
      input_request_json: string | null;
    };
    expect(row.input_request_json).toBeNull();
  });
});
