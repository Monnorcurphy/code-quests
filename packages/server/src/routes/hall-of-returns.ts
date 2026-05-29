import { Router } from 'express';
import Database from 'better-sqlite3';
import { z } from 'zod';
import {
  AdventurerSchema,
  AgentSchema,
  MonsterEncounterSchema,
  FailureSummarySchema,
} from '@code-quests/shared';

const ListQuerySchema = z.object({
  status: z.enum(['returned_to_town', 'complete']).default('returned_to_town'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

type QuestRow = {
  id: string;
  epic_id: string | null;
  title: string;
  description: string;
  acceptance_criteria_json: string;
  edge_cases_json: string;
  context: string;
  status: string;
  adventurer_id: string | null;
  agent_id: string | null;
  equipment_json: string;
  spec_audit_json: string | null;
  failure_summary_json: string | null;
  user_feedback_json: string | null;
  current_scene: string;
  created_at: string;
  updated_at: string;
  ac_locked_at: string | null;
};

type ListRow = QuestRow & {
  adv_id: string | null;
  adv_name: string | null;
  adv_class: string | null;
  fatal_monster_json: string | null;
};

type PostMortemRow = QuestRow & {
  adv_id: string | null;
  adv_name: string | null;
  adv_class: string | null;
  adv_model_id: string | null;
  adv_created_at: string | null;
  adv_stats_json: string | null;
  adv_specializations_json: string | null;
  adv_scars_json: string | null;
};

function rowToApi(row: QuestRow) {
  return {
    id: row.id,
    epicId: row.epic_id,
    title: row.title,
    description: row.description,
    acceptanceCriteria: JSON.parse(row.acceptance_criteria_json) as string[],
    edgeCases: JSON.parse(row.edge_cases_json) as string[],
    context: row.context,
    status: row.status,
    adventurerId: row.adventurer_id,
    agentId: row.agent_id,
    equipment: JSON.parse(row.equipment_json) as Record<string, unknown>,
    specAudit: row.spec_audit_json ? JSON.parse(row.spec_audit_json) : null,
    failureSummary: row.failure_summary_json ? JSON.parse(row.failure_summary_json) : null,
    userFeedback: row.user_feedback_json
      ? (JSON.parse(row.user_feedback_json) as unknown[])
      : [],
    currentScene: row.current_scene,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    acLockedAt: row.ac_locked_at,
  };
}

const LIST_SELECT = `
  SELECT q.*,
    adv.id AS adv_id, adv.name AS adv_name, adv.class AS adv_class,
    (
      SELECT json_object(
        'monsterId', me.monster_id,
        'monsterName', m.name,
        'spritePath', mt.sprite_path,
        'difficulty', m.calibrated_difficulty
      )
      FROM monster_encounters me
      JOIN monsters m ON m.id = me.monster_id
      JOIN monster_types mt ON mt.id = m.type_id
      WHERE me.quest_id = q.id AND me.outcome = 'defeat'
      ORDER BY me.appeared_at DESC
      LIMIT 1
    ) AS fatal_monster_json
  FROM quests q
  LEFT JOIN adventurers adv ON adv.id = q.adventurer_id
`;

export function createHallOfReturnsRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/quests', (req, res) => {
    const queryResult = ListQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      const first = queryResult.error.errors[0];
      const field = first.path.length > 0 ? String(first.path.join('.')) : undefined;
      res.status(400).json({ error: first.message, field });
      return;
    }
    const { status, limit, cursor } = queryResult.data;

    const rows: ListRow[] = cursor
      ? (db
          .prepare(
            `${LIST_SELECT} WHERE q.status = ? AND q.updated_at < ? ORDER BY q.updated_at DESC LIMIT ?`,
          )
          .all(status, cursor, limit + 1) as ListRow[])
      : (db
          .prepare(`${LIST_SELECT} WHERE q.status = ? ORDER BY q.updated_at DESC LIMIT ?`)
          .all(status, limit + 1) as ListRow[]);

    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;

    type FatalMonster = {
      monsterId: string;
      monsterName: string;
      spritePath: string;
      difficulty: number;
    };

    const result = items.map((row) => ({
      ...rowToApi(row),
      adventurer: row.adv_id
        ? { id: row.adv_id, name: row.adv_name, class: row.adv_class }
        : null,
      fatalMonster: row.fatal_monster_json
        ? (JSON.parse(row.fatal_monster_json) as FatalMonster)
        : null,
    }));

    const nextCursor = hasNextPage ? items[items.length - 1].updated_at : null;
    res.json({ items: result, nextCursor });
  });

  router.get('/quests/:questId/post-mortem', (req, res) => {
    const questId = req.params.questId;

    const questRow = db
      .prepare(
        `SELECT q.*,
          adv.id AS adv_id, adv.name AS adv_name, adv.class AS adv_class,
          adv.model_id AS adv_model_id, adv.created_at AS adv_created_at,
          adv.stats_json AS adv_stats_json,
          adv.specializations_json AS adv_specializations_json,
          adv.scars_json AS adv_scars_json
         FROM quests q
         LEFT JOIN adventurers adv ON adv.id = q.adventurer_id
         WHERE q.id = ?`,
      )
      .get(questId) as PostMortemRow | undefined;

    if (!questRow) {
      res.status(404).json({ error: 'Quest not found' });
      return;
    }

    const agentRows = db
      .prepare('SELECT * FROM agents WHERE quest_id = ? ORDER BY started_at')
      .all(questId) as Record<string, unknown>[];

    const attempts = agentRows.map((r) =>
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
        `SELECT me.*,
          m.type_id AS monster_type_id, m.name AS monster_name,
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

    const adventurer =
      questRow.adv_id && questRow.adv_stats_json
        ? AdventurerSchema.parse({
            id: questRow.adv_id,
            name: questRow.adv_name,
            class: questRow.adv_class,
            modelId: questRow.adv_model_id,
            createdAt: questRow.adv_created_at,
            stats: JSON.parse(questRow.adv_stats_json),
            specializations: JSON.parse(questRow.adv_specializations_json!),
            scars: JSON.parse(questRow.adv_scars_json!),
          })
        : null;

    const failureSummary = questRow.failure_summary_json
      ? FailureSummarySchema.parse(JSON.parse(questRow.failure_summary_json))
      : null;

    res.json({
      quest: rowToApi(questRow),
      attempts,
      encounters,
      failureSummary,
      adventurer,
    });
  });

  return router;
}
