import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({ default: vi.fn() }));
vi.mock('../agents/select-adapter', () => ({
  getQuestAdapter: vi.fn(),
  getDefaultQuestAdapter: vi.fn(),
  getAdapterForModel: vi.fn(),
  getAuditAdapter: vi.fn(),
}));
vi.mock('../lib/secret-store', () => ({
  getSecret: vi.fn(),
  setSecret: vi.fn(),
  deleteSecret: vi.fn(),
  hasSecret: vi.fn(),
}));

import Database from 'better-sqlite3';
import type { AgentEvent, Quest, Adventurer } from '@code-quests/shared';
import { QuestSchema, AdventurerSchema } from '@code-quests/shared';
import { openDb } from '../db/connection';
import { runMigrations } from '../db/migrator';
import { runQuest } from '../services/quest-runner';
import {
  getDefaultQuestAdapter,
  getAdapterForModel,
} from '../agents/select-adapter';
import { getSecret } from '../lib/secret-store';
import { offlineAdapter } from '../agents/offline-adapter';

function insertAdventurer(db: Database.Database, id: string): Adventurer {
  db.prepare(
    `INSERT INTO adventurers (id, name, class, model_id) VALUES (?, ?, ?, ?)`,
  ).run(id, `Hero ${id}`, 'ranger', 'claude-haiku');
  const row = db.prepare('SELECT * FROM adventurers WHERE id = ?').get(id) as Record<string, unknown>;
  return AdventurerSchema.parse({
    id: row['id'],
    name: row['name'],
    class: row['class'],
    modelId: row['model_id'],
    createdAt: row['created_at'],
    stats: {},
    specializations: [],
    scars: [],
  });
}

function insertModel(
  db: Database.Database,
  id: string,
  provider: string,
  modelId = 'sonnet',
  config: Record<string, unknown> = {},
): void {
  db.prepare(
    `INSERT INTO models (id, name, provider, model_id, config_json) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, `Model ${id}`, provider, modelId, JSON.stringify(config));
}

function insertQuest(
  db: Database.Database,
  id: string,
  advId: string,
  modelId: string | null,
): Quest {
  db.prepare(
    `INSERT INTO quests (id, title, description, adventurer_id, model_id, status, acceptance_criteria_json, edge_cases_json, equipment_json, current_scene)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    'Test Quest',
    'desc',
    advId,
    modelId,
    'active',
    '[]',
    '[]',
    JSON.stringify({ skillIds: [], toolIds: [], mcpServerIds: [] }),
    'quest-forest',
  );
  const row = db.prepare('SELECT * FROM quests WHERE id = ?').get(id) as Record<string, unknown>;
  return QuestSchema.parse({
    id: row['id'],
    epicId: row['epic_id'],
    projectId: row['project_id'],
    modelId: row['model_id'],
    title: row['title'],
    description: row['description'],
    acceptanceCriteria: JSON.parse(String(row['acceptance_criteria_json'])),
    edgeCases: JSON.parse(String(row['edge_cases_json'])),
    context: row['context'],
    status: row['status'],
    adventurerId: row['adventurer_id'],
    agentId: row['agent_id'],
    equipment: JSON.parse(String(row['equipment_json'])),
    specAudit: null,
    failureSummary: null,
    currentScene: row['current_scene'],
    inputRequest: null,
    userBlocker: null,
    createdAt: row['created_at'],
    updatedAt: row['updated_at'],
  });
}

function makeImmediateAdapter() {
  const events: AgentEvent[] = [
    { type: 'progress', timestamp: '2026-05-30T00:00:00.000Z', message: 'Working' },
    { type: 'completed', timestamp: '2026-05-30T00:00:01.000Z' },
  ];
  return {
    name: 'test',
    async spawn() {
      return {
        pid: 1234,
        async *events() {
          for (const e of events) yield e;
        },
        async cancel() {},
        async respond() {},
        async awaitExit() {
          return { exitCode: 0 as number | null };
        },
      };
    },
  };
}

describe('runQuest → model routing', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openDb(':memory:');
    runMigrations(db);
    vi.clearAllMocks();
  });

  afterEach(() => {
    db.close();
  });

  it('uses the default adapter when quest.modelId is null', async () => {
    const adapter = makeImmediateAdapter();
    vi.mocked(getDefaultQuestAdapter).mockReturnValue(adapter);

    const adventurer = insertAdventurer(db, 'adv-1');
    const quest = insertQuest(db, 'quest-1', 'adv-1', null);

    const result = await runQuest(quest, adventurer, { db });
    await result.done;

    expect(getDefaultQuestAdapter).toHaveBeenCalledTimes(1);
    expect(getAdapterForModel).not.toHaveBeenCalled();
  });

  it('looks up the model and uses the adapter for its provider when quest.modelId is set', async () => {
    const adapter = makeImmediateAdapter();
    vi.mocked(getAdapterForModel).mockReturnValue(adapter);

    insertModel(db, 'model-ollama', 'ollama', 'llama3.1:70b');
    const adventurer = insertAdventurer(db, 'adv-1');
    const quest = insertQuest(db, 'quest-1', 'adv-1', 'model-ollama');

    const result = await runQuest(quest, adventurer, { db });
    await result.done;

    expect(getAdapterForModel).toHaveBeenCalledTimes(1);
    const [arg] = vi.mocked(getAdapterForModel).mock.calls[0]!;
    expect(arg.id).toBe('model-ollama');
    expect(arg.provider).toBe('ollama');
    expect(getDefaultQuestAdapter).not.toHaveBeenCalled();
  });

  it('reads the API key from the keychain for providers that need one', async () => {
    const adapter = makeImmediateAdapter();
    const spawnSpy = vi.spyOn(adapter, 'spawn');
    vi.mocked(getAdapterForModel).mockReturnValue(adapter);
    vi.mocked(getSecret).mockResolvedValue('sk-or-test-fake');

    insertModel(db, 'model-or', 'openrouter', 'anthropic/claude-3.5-sonnet');
    const adventurer = insertAdventurer(db, 'adv-2');
    const quest = insertQuest(db, 'quest-2', 'adv-2', 'model-or');

    const result = await runQuest(quest, adventurer, { db });
    await result.done;

    expect(getSecret).toHaveBeenCalledWith('model-or');
    const spawnArg = spawnSpy.mock.calls[0]![0];
    expect(spawnArg.apiKey).toBe('sk-or-test-fake');
  });

  it('does NOT read keychain for providers that don\'t need one', async () => {
    const adapter = makeImmediateAdapter();
    const spawnSpy = vi.spyOn(adapter, 'spawn');
    vi.mocked(getAdapterForModel).mockReturnValue(adapter);

    insertModel(db, 'model-cli', 'claude_cli', 'sonnet');
    const adventurer = insertAdventurer(db, 'adv-3');
    const quest = insertQuest(db, 'quest-3', 'adv-3', 'model-cli');

    const result = await runQuest(quest, adventurer, { db });
    await result.done;

    expect(getSecret).not.toHaveBeenCalled();
    const spawnArg = spawnSpy.mock.calls[0]![0];
    expect(spawnArg.apiKey).toBeUndefined();
    expect(spawnArg.model?.provider).toBe('claude_cli');
  });

  it('throws when the linked model no longer exists', async () => {
    // Create a quest with a model, then delete the model so runQuest sees a
    // dangling id. (Direct insert with a fake id hits the FK constraint.)
    insertModel(db, 'transient-model', 'ollama', 'qwen2.5:7b');
    const adventurer = insertAdventurer(db, 'adv-4');
    const quest = insertQuest(db, 'quest-4', 'adv-4', 'transient-model');
    // The quest still references the model; null it out via DB so we can
    // delete the model, then put the dangling id back on the JS quest object.
    db.prepare('UPDATE quests SET model_id = NULL WHERE id = ?').run('quest-4');
    db.prepare('DELETE FROM models WHERE id = ?').run('transient-model');
    const dangling = { ...quest, modelId: 'transient-model' } as typeof quest;

    await expect(runQuest(dangling, adventurer, { db })).rejects.toThrow(/no such model exists/i);
  });

  it('throws a clear error when an api-key provider has no key stored', async () => {
    const adapter = makeImmediateAdapter();
    vi.mocked(getAdapterForModel).mockReturnValue(adapter);
    vi.mocked(getSecret).mockResolvedValue(null);

    insertModel(db, 'model-or-2', 'openrouter', 'meta-llama/llama-3.3-70b');
    const adventurer = insertAdventurer(db, 'adv-5');
    const quest = insertQuest(db, 'quest-5', 'adv-5', 'model-or-2');

    await expect(runQuest(quest, adventurer, { db })).rejects.toThrow(/requires an API key/i);
  });

  it('bumps last_used_at on the model after a successful dispatch', async () => {
    const adapter = makeImmediateAdapter();
    vi.mocked(getAdapterForModel).mockReturnValue(adapter);

    insertModel(db, 'model-ll', 'ollama', 'qwen2.5:7b');
    const adventurer = insertAdventurer(db, 'adv-6');
    const quest = insertQuest(db, 'quest-6', 'adv-6', 'model-ll');

    const beforeRow = db
      .prepare('SELECT last_used_at FROM models WHERE id = ?')
      .get('model-ll') as { last_used_at: string | null };
    expect(beforeRow.last_used_at).toBeNull();

    const result = await runQuest(quest, adventurer, { db });
    await result.done;

    const afterRow = db
      .prepare('SELECT last_used_at FROM models WHERE id = ?')
      .get('model-ll') as { last_used_at: string | null };
    expect(afterRow.last_used_at).not.toBeNull();
  });
});

// Touch the offlineAdapter import so the linter doesn't complain (used by other
// tests in this directory to keep the module loaded).
void offlineAdapter;
