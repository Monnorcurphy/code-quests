import { Router } from 'express';
import Database from 'better-sqlite3';
import { z } from 'zod';
import { AdventurerClassSchema, AdventurerStyleSchema } from '@code-quests/shared';
import { validate } from '../middleware/validate';

const CreateAdventurerSchema = z.object({
  name: z.string().min(1),
  class: AdventurerClassSchema,
  modelId: z.string().min(1),
  stats: z.record(z.unknown()).default({}),
  specializations: z.array(z.string()).default([]),
  scars: z.array(z.string()).default([]),
  style: AdventurerStyleSchema.default({}),
});

const PatchAdventurerSchema = CreateAdventurerSchema.partial();

const UpdateStyleSchema = z.object({
  style: AdventurerStyleSchema,
});

type CreateAdventurer = z.infer<typeof CreateAdventurerSchema>;
type PatchAdventurer = z.infer<typeof PatchAdventurerSchema>;
type UpdateStyle = z.infer<typeof UpdateStyleSchema>;

type AdventurerRow = {
  id: string;
  name: string;
  class: string;
  model_id: string;
  created_at: string;
  stats_json: string;
  specializations_json: string;
  scars_json: string;
  style_json: string;
};

function parseStyleJson(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fall through to empty object on malformed JSON — never crash a list call.
  }
  return {};
}

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
    style: parseStyleJson(row.style_json ?? '{}'),
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
      'INSERT INTO adventurers (id, name, class, model_id, stats_json, specializations_json, scars_json, style_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      id,
      body.name,
      body.class,
      body.modelId,
      JSON.stringify(body.stats),
      JSON.stringify(body.specializations),
      JSON.stringify(body.scars),
      JSON.stringify(body.style ?? {}),
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
    if (body.style !== undefined) { cols.push('style_json = ?'); vals.push(JSON.stringify(body.style)); }
    if (cols.length > 0) {
      vals.push(req.params.id);
      db.prepare(`UPDATE adventurers SET ${cols.join(', ')} WHERE id = ?`).run(...(vals as Parameters<typeof db.prepare>));
    }
    const updated = db.prepare('SELECT * FROM adventurers WHERE id = ?').get(req.params.id) as AdventurerRow;
    res.json(rowToApi(updated));
  });

  router.patch('/:id/style', validate(UpdateStyleSchema), (req, res) => {
    const existing = db.prepare('SELECT id FROM adventurers WHERE id = ?').get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Adventurer not found' });
      return;
    }
    const body = req.body as UpdateStyle;
    db.prepare('UPDATE adventurers SET style_json = ? WHERE id = ?').run(
      JSON.stringify(body.style),
      req.params.id,
    );
    const updated = db.prepare('SELECT * FROM adventurers WHERE id = ?').get(req.params.id) as AdventurerRow;
    res.json(rowToApi(updated));
  });

  router.delete('/:id', (req, res) => {
    const existing = db.prepare('SELECT id, name FROM adventurers WHERE id = ?').get(req.params.id) as
      | { id: string; name: string }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Adventurer not found' });
      return;
    }

    // Refuse if the adventurer is currently on a quest. Killing them mid-run
    // would orphan the agent subprocess and leave the quest in a half-state.
    const inFlight = db
      .prepare(
        `SELECT id, status FROM quests
         WHERE adventurer_id = ?
         AND status IN ('active', 'paused_input', 'user_blocked')
         LIMIT 1`,
      )
      .get(req.params.id) as { id: string; status: string } | undefined;
    if (inFlight) {
      res.status(409).json({
        error: `${existing.name} is currently on a quest. Finish or cancel it before dismissing.`,
        code: 'ADVENTURER_BUSY',
        questId: inFlight.id,
        questStatus: inFlight.status,
      });
      return;
    }

    // Preserve historical quest records — Hall of Returns shows past quests
    // by adventurer. We null adventurer_id on quests so the rows survive.
    // Agent rows have a NOT NULL FK to adventurers, so we remove them; that's
    // OK because they're process records, not user-facing artifacts. The
    // quest_id FK on monster_encounters still resolves because quests stay.
    const tx = db.transaction(() => {
      db.prepare('UPDATE quests SET adventurer_id = NULL WHERE adventurer_id = ?').run(
        req.params.id,
      );
      db.prepare('UPDATE quests SET agent_id = NULL WHERE agent_id IN (SELECT id FROM agents WHERE adventurer_id = ?)').run(
        req.params.id,
      );
      db.prepare('DELETE FROM agents WHERE adventurer_id = ?').run(req.params.id);
      db.prepare('DELETE FROM adventurers WHERE id = ?').run(req.params.id);
    });
    tx();
    res.status(204).send();
  });

  return router;
}
