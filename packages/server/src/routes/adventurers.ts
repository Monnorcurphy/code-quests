import { Router } from 'express';
import Database from 'better-sqlite3';
import { z } from 'zod';
import { AdventurerClassSchema } from '@code-quests/shared';
import { validate } from '../middleware/validate';

const CreateAdventurerSchema = z.object({
  name: z.string().min(1),
  class: AdventurerClassSchema,
  modelId: z.string().min(1),
  stats: z.record(z.unknown()).default({}),
  specializations: z.array(z.string()).default([]),
  scars: z.array(z.string()).default([]),
});

const PatchAdventurerSchema = CreateAdventurerSchema.partial();

type CreateAdventurer = z.infer<typeof CreateAdventurerSchema>;
type PatchAdventurer = z.infer<typeof PatchAdventurerSchema>;

type AdventurerRow = {
  id: string;
  name: string;
  class: string;
  model_id: string;
  created_at: string;
  stats_json: string;
  specializations_json: string;
  scars_json: string;
};

function rowToApi(row: AdventurerRow) {
  return {
    id: row.id,
    name: row.name,
    class: row.class,
    modelId: row.model_id,
    createdAt: row.created_at,
    stats: JSON.parse(row.stats_json) as Record<string, unknown>,
    specializations: JSON.parse(row.specializations_json) as string[],
    scars: JSON.parse(row.scars_json) as string[],
  };
}

export function createAdventurersRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const rows = db.prepare('SELECT * FROM adventurers ORDER BY created_at').all() as AdventurerRow[];
    res.json(rows.map(rowToApi));
  });

  router.post('/', validate(CreateAdventurerSchema), (req, res) => {
    const body = req.body as CreateAdventurer;
    const id = crypto.randomUUID();
    db.prepare(
      'INSERT INTO adventurers (id, name, class, model_id, stats_json, specializations_json, scars_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(
      id,
      body.name,
      body.class,
      body.modelId,
      JSON.stringify(body.stats),
      JSON.stringify(body.specializations),
      JSON.stringify(body.scars),
    );
    const row = db.prepare('SELECT * FROM adventurers WHERE id = ?').get(id) as AdventurerRow;
    res.status(201).json(rowToApi(row));
  });

  router.get('/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM adventurers WHERE id = ?').get(req.params.id) as AdventurerRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Adventurer not found' });
      return;
    }
    res.json(rowToApi(row));
  });

  router.patch('/:id', validate(PatchAdventurerSchema), (req, res) => {
    const existing = db.prepare('SELECT id FROM adventurers WHERE id = ?').get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Adventurer not found' });
      return;
    }
    const body = req.body as PatchAdventurer;
    const cols: string[] = [];
    const vals: unknown[] = [];
    if (body.name !== undefined) { cols.push('name = ?'); vals.push(body.name); }
    if (body.class !== undefined) { cols.push('class = ?'); vals.push(body.class); }
    if (body.modelId !== undefined) { cols.push('model_id = ?'); vals.push(body.modelId); }
    if (body.stats !== undefined) { cols.push('stats_json = ?'); vals.push(JSON.stringify(body.stats)); }
    if (body.specializations !== undefined) { cols.push('specializations_json = ?'); vals.push(JSON.stringify(body.specializations)); }
    if (body.scars !== undefined) { cols.push('scars_json = ?'); vals.push(JSON.stringify(body.scars)); }
    if (cols.length > 0) {
      vals.push(req.params.id);
      db.prepare(`UPDATE adventurers SET ${cols.join(', ')} WHERE id = ?`).run(...(vals as Parameters<typeof db.prepare>));
    }
    const updated = db.prepare('SELECT * FROM adventurers WHERE id = ?').get(req.params.id) as AdventurerRow;
    res.json(rowToApi(updated));
  });

  router.delete('/:id', (req, res) => {
    const existing = db.prepare('SELECT id FROM adventurers WHERE id = ?').get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Adventurer not found' });
      return;
    }
    db.prepare('DELETE FROM adventurers WHERE id = ?').run(req.params.id);
    res.status(204).send();
  });

  return router;
}
