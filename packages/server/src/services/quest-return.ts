import type Database from 'better-sqlite3';
import {
  QuestSchema,
  AdventurerSchema,
  AgentSchema,
  MonsterEncounterSchema,
} from '@code-quests/shared';
import type { AgentEvent } from '@code-quests/shared';
import { buildFailureSummary } from '../lib/failure-summary';
import { mintScar } from '../lib/scar';

export class QuestReturnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuestReturnError';
  }
}

type Channel = {
  publishQuestEvent: (questId: string, event: AgentEvent) => void;
};

type QuestWithAdventurerRow = Record<string, unknown>;

function parseQuestRow(row: QuestWithAdventurerRow) {
  return QuestSchema.parse({
    id: row['id'],
    epicId: row['epic_id'] ?? null,
    title: row['title'],
    description: row['description'],
    acceptanceCriteria: JSON.parse(row['acceptance_criteria_json'] as string) as string[],
    edgeCases: JSON.parse(row['edge_cases_json'] as string) as string[],
    context: row['context'],
    status: row['status'],
    adventurerId: row['adventurer_id'] ?? null,
    agentId: row['agent_id'] ?? null,
    equipment: JSON.parse(row['equipment_json'] as string),
    specAudit: row['spec_audit_json'] ? JSON.parse(row['spec_audit_json'] as string) : null,
    failureSummary: row['failure_summary_json'] ? JSON.parse(row['failure_summary_json'] as string) : null,
    currentScene: row['current_scene'] ?? 'quest-forest',
    inputRequest: null,
    userBlocker: null,
    createdAt: row['created_at'] as string,
    updatedAt: row['updated_at'] as string,
  });
}

function parseAdventurerFromRow(row: QuestWithAdventurerRow) {
  if (!row['adv_id']) return null;
  return AdventurerSchema.parse({
    id: row['adv_id'],
    name: row['adv_name'],
    class: row['adv_class'],
    modelId: row['adv_model_id'],
    createdAt: row['adv_created_at'],
    stats: JSON.parse(row['adv_stats_json'] as string),
    specializations: JSON.parse(row['adv_specializations_json'] as string),
    scars: JSON.parse(row['adv_scars_json'] as string),
  });
}

export function returnQuestToTown(
  questId: string,
  db: Database.Database,
  channel?: Channel,
): void {
  const row = db
    .prepare(
      `SELECT q.*,
              adv.id AS adv_id, adv.name AS adv_name, adv.class AS adv_class,
              adv.model_id AS adv_model_id, adv.created_at AS adv_created_at,
              adv.stats_json AS adv_stats_json, adv.specializations_json AS adv_specializations_json,
              adv.scars_json AS adv_scars_json
       FROM quests q
       LEFT JOIN adventurers adv ON adv.id = q.adventurer_id
       WHERE q.id = ?`,
    )
    .get(questId) as QuestWithAdventurerRow | undefined;

  if (!row) throw new QuestReturnError(`Quest ${questId} not found`);

  const quest = parseQuestRow(row);
  const adventurer = parseAdventurerFromRow(row);

  const agentRows = db
    .prepare('SELECT * FROM agents WHERE quest_id = ? ORDER BY started_at')
    .all(questId) as Record<string, unknown>[];

  const agents = agentRows.map((r) =>
    AgentSchema.parse({
      id: r['id'],
      adventurerId: r['adventurer_id'],
      questId: r['quest_id'],
      startedAt: r['started_at'],
      endedAt: r['ended_at'] ?? null,
      pid: r['pid'] ?? null,
      exitCode: r['exit_code'] ?? null,
    }),
  );

  const encounterRows = db
    .prepare(
      `SELECT me.*, m.type_id AS monster_type_id, m.name AS monster_name,
              m.calibrated_difficulty AS difficulty, mt.sprite_path
       FROM monster_encounters me
       JOIN monsters m ON m.id = me.monster_id
       JOIN monster_types mt ON mt.id = m.type_id
       WHERE me.quest_id = ?
       ORDER BY me.appeared_at`,
    )
    .all(questId) as Record<string, unknown>[];

  const encounters = encounterRows.map((r) =>
    MonsterEncounterSchema.parse({
      id: r['id'],
      monsterId: r['monster_id'],
      questId: r['quest_id'],
      appearedAt: r['appeared_at'],
      combatLog: JSON.parse(r['combat_log_json'] as string),
      outcome: r['outcome'],
      loot: JSON.parse(r['loot_json'] as string),
      resolvedAt: r['resolved_at'] ?? null,
      monsterTypeId: r['monster_type_id'] as string,
      monsterName: r['monster_name'] as string,
      spritePath: r['sprite_path'] as string,
      difficulty: r['difficulty'] as number,
    }),
  );

  const failureSummary = buildFailureSummary(quest, agents, encounters);

  const fatalEncounter = encounters
    .filter((e) => e.outcome === 'defeat')
    .sort((a, b) => b.appearedAt.localeCompare(a.appearedAt))[0];

  const lifetimeQuestCount = adventurer
    ? (
        db
          .prepare(
            `SELECT COUNT(*) AS count FROM quests
             WHERE adventurer_id = ? AND status IN ('complete','failed','returned_to_town','retired')`,
          )
          .get(adventurer.id) as { count: number }
      ).count
    : 0;

  const scarRecord = adventurer
    ? mintScar(quest, adventurer, failureSummary, {
        fatalMonsterId: fatalEncounter?.monsterId ?? '',
        lifetimeQuestCount,
      })
    : null;

  db.transaction(() => {
    const now = new Date().toISOString();

    const result = db
      .prepare(
        `UPDATE quests
         SET status = 'returned_to_town', failure_summary_json = ?, updated_at = ?
         WHERE id = ? AND status = 'failed'`,
      )
      .run(JSON.stringify(failureSummary), now, questId) as { changes: number };

    if (result.changes === 0) {
      const statusRow = db
        .prepare('SELECT status FROM quests WHERE id = ?')
        .get(questId) as { status: string } | undefined;
      throw new QuestReturnError(
        `Quest ${questId} cannot transition to returned_to_town: current status is '${statusRow?.status ?? 'unknown'}'`,
      );
    }

    if (adventurer && scarRecord) {
      const newScars = [...adventurer.scars, scarRecord];
      db.prepare('UPDATE adventurers SET scars_json = ? WHERE id = ?').run(
        JSON.stringify(newScars),
        adventurer.id,
      );
    }
  })();

  if (channel) {
    const event: AgentEvent = {
      type: 'quest_returned',
      timestamp: new Date().toISOString(),
      questId,
      failureSummary,
      scarAdded: scarRecord !== null,
    };
    channel.publishQuestEvent(questId, event);
  }
}
