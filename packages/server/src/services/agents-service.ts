import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import { AgentSchema } from '@code-quests/shared';
import type { Agent } from '@code-quests/shared';

interface AgentRow {
  id: string;
  adventurer_id: string;
  quest_id: string;
  started_at: string;
  ended_at: string | null;
  pid: number | null;
  exit_code: number | null;
}

function rowToAgent(row: AgentRow): Agent {
  return AgentSchema.parse({
    id: row.id,
    adventurerId: row.adventurer_id,
    questId: row.quest_id,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? null,
    pid: row.pid ?? null,
    exitCode: row.exit_code ?? null,
  });
}

export interface CreateAgentInput {
  adventurerId: string;
  questId: string;
  pid: number | null;
}

export function createAgent(db: Database.Database, input: CreateAgentInput): Agent {
  const id = randomUUID();
  db.prepare(
    'INSERT INTO agents (id, adventurer_id, quest_id, pid) VALUES (?, ?, ?, ?)',
  ).run(id, input.adventurerId, input.questId, input.pid);
  const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as AgentRow;
  return rowToAgent(row);
}

export function endAgent(
  db: Database.Database,
  agentId: string,
  exitCode: number | null,
): Agent {
  db.prepare(
    "UPDATE agents SET ended_at = datetime('now'), exit_code = ? WHERE id = ?",
  ).run(exitCode, agentId);
  const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId) as AgentRow;
  return rowToAgent(row);
}

export function findAgentByQuest(
  db: Database.Database,
  questId: string,
): Agent | null {
  const row = db
    .prepare('SELECT * FROM agents WHERE quest_id = ? ORDER BY started_at DESC LIMIT 1')
    .get(questId) as AgentRow | undefined;
  if (!row) return null;
  return rowToAgent(row);
}

export function findActiveAgents(db: Database.Database): Agent[] {
  const rows = db
    .prepare('SELECT * FROM agents WHERE ended_at IS NULL')
    .all() as AgentRow[];
  return rows.map(rowToAgent);
}
