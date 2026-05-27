import { Router } from 'express';
import Database from 'better-sqlite3';
import { z } from 'zod';
import { validate } from '../middleware/validate';

const CreateEpicSchema = z.object({
  title: z.string().min(1),
  goal: z.string().min(1),
});

const PatchEpicSchema = CreateEpicSchema.partial();

type CreateEpic = z.infer<typeof CreateEpicSchema>;
type PatchEpic = z.infer<typeof PatchEpicSchema>;

type EpicRow = {
  id: string;
  title: string;
  goal: string;
  created_at: string;
};

function rowToApi(row: EpicRow) {
  return {
    id: row.id,
    title: row.title,
    goal: row.goal,
    createdAt: row.created_at,
  };
}

export function createEpicsRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const rows = db.prepare('SELECT * FROM epics ORDER BY created_at').all() as EpicRow[];
    res.json(rows.map(rowToApi));
  });

  router.post('/', validate(CreateEpicSchema), (req, res) => {
    const body = req.body as CreateEpic;
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO epics (id, title, goal) VALUES (?, ?, ?)').run(id, body.title, body.goal);
    const row = db.prepare('SELECT * FROM epics WHERE id = ?').get(id) as EpicRow;
    res.status(201).json(rowToApi(row));
  });

  router.get('/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM epics WHERE id = ?').get(req.params.id) as EpicRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Epic not found' });
      return;
    }
    res.json(rowToApi(row));
  });

  router.patch('/:id', validate(PatchEpicSchema), (req, res) => {
    const existing = db.prepare('SELECT id FROM epics WHERE id = ?').get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Epic not found' });
      return;
    }
    const body = req.body as PatchEpic;
    const cols: string[] = [];
    const vals: unknown[] = [];
    if (body.title !== undefined) { cols.push('title = ?'); vals.push(body.title); }
    if (body.goal !== undefined) { cols.push('goal = ?'); vals.push(body.goal); }
    if (cols.length > 0) {
      vals.push(req.params.id);
      db.prepare(`UPDATE epics SET ${cols.join(', ')} WHERE id = ?`).run(...(vals as Parameters<typeof db.prepare>));
    }
    const updated = db.prepare('SELECT * FROM epics WHERE id = ?').get(req.params.id) as EpicRow;
    res.json(rowToApi(updated));
  });

  router.delete('/:id', (req, res) => {
    const existing = db.prepare('SELECT id FROM epics WHERE id = ?').get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Epic not found' });
      return;
    }
    db.prepare('DELETE FROM epics WHERE id = ?').run(req.params.id);
    res.status(204).send();
  });

  return router;
}
