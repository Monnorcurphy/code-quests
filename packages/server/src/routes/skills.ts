import { randomUUID } from 'crypto';
import { Router } from 'express';
import Database from 'better-sqlite3';
import { z } from 'zod';
import { ForgeSkillSchema, ConfirmCandidateSchema } from '@code-quests/shared';
import { validate } from '../middleware/validate';

const StatusQuerySchema = z.enum(['active', 'candidate', 'retired']);

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

  router.get('/', (req, res) => {
    const hasFilter = req.query['status'] !== undefined;
    if (hasFilter) {
      const statusResult = StatusQuerySchema.safeParse(req.query['status']);
      if (!statusResult.success) {
        res.status(400).json({ error: 'status must be active, candidate, or retired', field: 'status' });
        return;
      }
      const rows = db.prepare('SELECT * FROM skills WHERE status = ? ORDER BY created_at').all(statusResult.data) as SkillRow[];
      res.json(rows.map(rowToApi));
      return;
    }
    const rows = db.prepare('SELECT * FROM skills ORDER BY created_at').all() as SkillRow[];
    res.json(rows.map(rowToApi));
  });

  router.get('/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params['id']) as SkillRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Skill not found' });
      return;
    }
    res.json(rowToApi(row));
  });

  router.post('/', validate(ForgeSkillSchema), (req, res) => {
    const input = req.body as z.infer<typeof ForgeSkillSchema>;

    for (const typeId of input.monsterTypeIds) {
      const exists = db.prepare('SELECT id FROM monster_types WHERE id = ?').get(typeId);
      if (!exists) {
        res.status(400).json({ error: `Monster type '${typeId}' does not exist`, field: 'monsterTypeIds' });
        return;
      }
    }

    const id = randomUUID();
    db.prepare(
      `INSERT INTO skills (id, name, monster_type_ids_json, status, created_by, hit_count, implementation)
       VALUES (?, ?, ?, 'active', 'user', 0, ?)`,
    ).run(id, input.name, JSON.stringify(input.monsterTypeIds), input.implementation);

    const row = db.prepare('SELECT * FROM skills WHERE id = ?').get(id) as SkillRow;
    res.status(201).json(rowToApi(row));
  });

  router.post('/:id/confirm', validate(ConfirmCandidateSchema), (req, res) => {
    const row = db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params['id']) as SkillRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Skill not found' });
      return;
    }
    if (row.status !== 'candidate') {
      res.status(400).json({ error: 'Only candidate skills can be confirmed' });
      return;
    }

    const input = req.body as z.infer<typeof ConfirmCandidateSchema>;
    const newName = input.name ?? row.name;
    const newImpl = input.implementation ?? row.implementation;

    db.prepare(
      `UPDATE skills SET status = 'active', name = ?, implementation = ? WHERE id = ?`,
    ).run(newName, newImpl, row.id);

    const updated = db.prepare('SELECT * FROM skills WHERE id = ?').get(row.id) as SkillRow;
    res.json(rowToApi(updated));
  });

  router.post('/:id/dismiss', (req, res) => {
    const row = db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params['id']) as SkillRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Skill not found' });
      return;
    }
    if (row.status !== 'candidate') {
      res.status(400).json({ error: 'Only candidate skills can be dismissed' });
      return;
    }

    db.prepare('DELETE FROM skills WHERE id = ?').run(row.id);
    res.status(204).send();
  });

  router.post('/:id/retire', (req, res) => {
    const row = db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params['id']) as SkillRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Skill not found' });
      return;
    }
    if (row.status !== 'active') {
      res.status(400).json({ error: 'Only active skills can be retired' });
      return;
    }

    db.prepare(`UPDATE skills SET status = 'retired' WHERE id = ?`).run(row.id);
    const updated = db.prepare('SELECT * FROM skills WHERE id = ?').get(row.id) as SkillRow;
    res.json(rowToApi(updated));
  });

  return router;
}
