import { Router } from 'express';
import Database from 'better-sqlite3';

type SkillRow = {
  id: string;
  name: string;
  monster_type_ids_json: string;
  status: string;
  created_by: string;
  created_at: string;
  hit_count: number;
  implementation: string;
};

function rowToApi(row: SkillRow) {
  return {
    id: row.id,
    name: row.name,
    monsterTypeIds: JSON.parse(row.monster_type_ids_json) as string[],
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    hitCount: row.hit_count,
    implementation: row.implementation,
  };
}

export function createSkillsRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const rows = db.prepare('SELECT * FROM skills ORDER BY created_at').all() as SkillRow[];
    res.json(rows.map(rowToApi));
  });

  return router;
}
