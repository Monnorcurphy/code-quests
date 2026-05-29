import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';

export const CANDIDATE_VICTORY_THRESHOLD = 3;

export interface EvaluateSkillCandidateResult {
  created: boolean;
  updated: boolean;
  skillId?: string;
}

export interface EvaluateSkillCandidateOpts {
  adventurerId: string;
  monsterTypeId: string;
}

export function evaluateSkillCandidate(
  db: Database.Database,
  opts: EvaluateSkillCandidateOpts,
): EvaluateSkillCandidateResult {
  const { adventurerId, monsterTypeId } = opts;

  const countRow = db
    .prepare(
      `SELECT COUNT(*) as count
       FROM monster_encounters me
       JOIN monsters m ON me.monster_id = m.id
       JOIN quests q ON me.quest_id = q.id
       WHERE m.type_id = ?
         AND me.outcome = 'victory'
         AND q.adventurer_id = ?`,
    )
    .get(monsterTypeId, adventurerId) as { count: number };

  if (countRow.count < CANDIDATE_VICTORY_THRESHOLD) {
    return { created: false, updated: false };
  }

  const now = new Date().toISOString();

  const activeSkill = db
    .prepare(
      `SELECT id FROM skills
       WHERE status IN ('active', 'retired')
         AND EXISTS (
           SELECT 1 FROM json_each(monster_type_ids_json) WHERE value = ?
         )
       LIMIT 1`,
    )
    .get(monsterTypeId) as { id: string } | undefined;

  if (activeSkill) {
    db.prepare(
      `UPDATE skills SET hit_count = hit_count + 1, last_detection_at = ? WHERE id = ?`,
    ).run(now, activeSkill.id);
    return { created: false, updated: true, skillId: activeSkill.id };
  }

  const candidateSkill = db
    .prepare(
      `SELECT id FROM skills
       WHERE status = 'candidate'
         AND EXISTS (
           SELECT 1 FROM json_each(monster_type_ids_json) WHERE value = ?
         )
       LIMIT 1`,
    )
    .get(monsterTypeId) as { id: string } | undefined;

  if (candidateSkill) {
    db.prepare(
      `UPDATE skills SET hit_count = hit_count + 1, last_detection_at = ? WHERE id = ?`,
    ).run(now, candidateSkill.id);
    return { created: false, updated: true, skillId: candidateSkill.id };
  }

  const mtRow = db
    .prepare(`SELECT name FROM monster_types WHERE id = ?`)
    .get(monsterTypeId) as { name: string } | undefined;
  const monsterTypeName = mtRow?.name ?? monsterTypeId;

  const skillId = randomUUID();
  db.prepare(
    `INSERT INTO skills
       (id, name, monster_type_ids_json, status, created_by, hit_count, implementation,
        detected_for_adventurer_id, last_detection_at)
     VALUES (?, ?, ?, 'candidate', 'system', 1, '', ?, ?)`,
  ).run(skillId, `Auto: ${monsterTypeName}`, JSON.stringify([monsterTypeId]), adventurerId, now);

  return { created: true, updated: false, skillId };
}
