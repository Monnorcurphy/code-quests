import { Router, Response } from 'express';
import Database from 'better-sqlite3';
import { z } from 'zod';
import { QuestStatusSchema, EquipmentSchema, SpecAuditSchema, QuestSchema } from '@code-quests/shared';
import { validate } from '../middleware/validate';
import { auditQuest } from '../audit/audit-quest';
import { getAuditAdapter } from '../agents/select-adapter';

const CreateQuestSchema = z.object({
  title: z.string().min(1),
  epicId: z.string().min(1).nullable().default(null),
  description: z.string().default(''),
  acceptanceCriteria: z.array(z.string()).default([]),
  edgeCases: z.array(z.string()).default([]),
  context: z.string().default(''),
  status: QuestStatusSchema.default('idle'),
  adventurerId: z.string().min(1).nullable().default(null),
  agentId: z.string().nullable().default(null),
  equipment: EquipmentSchema.default({ skillIds: [], toolIds: [], mcpServerIds: [] }),
  specAudit: SpecAuditSchema.nullable().default(null),
});

const PatchQuestSchema = CreateQuestSchema.partial();

type CreateQuest = z.infer<typeof CreateQuestSchema>;
type PatchQuest = z.infer<typeof PatchQuestSchema>;

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
  created_at: string;
  updated_at: string;
  ac_locked_at: string | null;
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    acLockedAt: row.ac_locked_at,
  };
}

function assertReferenceExists(
  db: Database.Database,
  table: 'epics' | 'adventurers',
  id: string | null | undefined,
  field: string,
  res: Response,
): boolean {
  if (id == null) return true;
  const row = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id);
  if (!row) {
    res.status(400).json({ error: `${field} does not reference an existing ${table.slice(0, -1)}`, field });
    return false;
  }
  return true;
}

export function createQuestsRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const rows = db.prepare('SELECT * FROM quests ORDER BY created_at').all() as QuestRow[];
    res.json(rows.map(rowToApi));
  });

  router.post('/', validate(CreateQuestSchema), (req, res) => {
    const body = req.body as CreateQuest;
    if (!assertReferenceExists(db, 'epics', body.epicId, 'epicId', res)) return;
    if (!assertReferenceExists(db, 'adventurers', body.adventurerId, 'adventurerId', res)) return;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO quests
        (id, epic_id, title, description, acceptance_criteria_json, edge_cases_json,
         context, status, adventurer_id, agent_id, equipment_json, spec_audit_json,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      body.epicId,
      body.title,
      body.description,
      JSON.stringify(body.acceptanceCriteria),
      JSON.stringify(body.edgeCases),
      body.context,
      body.status,
      body.adventurerId,
      body.agentId,
      JSON.stringify(body.equipment),
      body.specAudit ? JSON.stringify(body.specAudit) : null,
      now,
      now,
    );
    const row = db.prepare('SELECT * FROM quests WHERE id = ?').get(id) as QuestRow;
    res.status(201).json(rowToApi(row));
  });

  router.get('/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM quests WHERE id = ?').get(req.params.id) as QuestRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Quest not found' });
      return;
    }
    res.json(rowToApi(row));
  });

  router.patch('/:id', validate(PatchQuestSchema), (req, res) => {
    const existing = db.prepare('SELECT * FROM quests WHERE id = ?').get(req.params.id) as QuestRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Quest not found' });
      return;
    }
    const body = req.body as PatchQuest;
    if (!assertReferenceExists(db, 'epics', body.epicId, 'epicId', res)) return;
    if (!assertReferenceExists(db, 'adventurers', body.adventurerId, 'adventurerId', res)) return;
    if (body.acceptanceCriteria !== undefined && existing.ac_locked_at !== null) {
      res.status(400).json({
        error: 'Acceptance criteria are locked and cannot be modified once a quest has been claimed',
        field: 'acceptanceCriteria',
      });
      return;
    }
    const cols: string[] = [];
    const vals: unknown[] = [];
    if (body.title !== undefined) { cols.push('title = ?'); vals.push(body.title); }
    if (body.epicId !== undefined) { cols.push('epic_id = ?'); vals.push(body.epicId); }
    if (body.description !== undefined) { cols.push('description = ?'); vals.push(body.description); }
    if (body.acceptanceCriteria !== undefined) { cols.push('acceptance_criteria_json = ?'); vals.push(JSON.stringify(body.acceptanceCriteria)); }
    if (body.edgeCases !== undefined) { cols.push('edge_cases_json = ?'); vals.push(JSON.stringify(body.edgeCases)); }
    if (body.context !== undefined) { cols.push('context = ?'); vals.push(body.context); }
    if (body.status !== undefined) { cols.push('status = ?'); vals.push(body.status); }
    if (body.adventurerId !== undefined) { cols.push('adventurer_id = ?'); vals.push(body.adventurerId); }
    if (body.agentId !== undefined) { cols.push('agent_id = ?'); vals.push(body.agentId); }
    if (body.equipment !== undefined) { cols.push('equipment_json = ?'); vals.push(JSON.stringify(body.equipment)); }
    if (body.specAudit !== undefined) { cols.push('spec_audit_json = ?'); vals.push(body.specAudit ? JSON.stringify(body.specAudit) : null); }
    if (cols.length > 0) {
      cols.push('updated_at = ?');
      vals.push(new Date().toISOString());
      vals.push(req.params.id);
      db.prepare(`UPDATE quests SET ${cols.join(', ')} WHERE id = ?`).run(...(vals as Parameters<typeof db.prepare>));
    }
    const updated = db.prepare('SELECT * FROM quests WHERE id = ?').get(req.params.id) as QuestRow;
    res.json(rowToApi(updated));
  });

  router.post('/:id/audit', (req, res) => {
    const row = db.prepare('SELECT * FROM quests WHERE id = ?').get(req.params.id) as QuestRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Quest not found' });
      return;
    }
    void (async () => {
      try {
        const quest = QuestSchema.parse(rowToApi(row));
        const adapter = getAuditAdapter();
        const audit = await auditQuest(quest, adapter);
        const now = new Date().toISOString();
        db.prepare('UPDATE quests SET spec_audit_json = ?, updated_at = ? WHERE id = ?')
          .run(JSON.stringify(audit), now, req.params.id);
        res.json(audit);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[quests] POST /quests/:id/audit failed: ${msg}\n`);
        res.status(500).json({ error: 'Failed to run audit' });
      }
    })();
  });

  router.delete('/:id', (req, res) => {
    const existing = db.prepare('SELECT id FROM quests WHERE id = ?').get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Quest not found' });
      return;
    }
    db.prepare('DELETE FROM quests WHERE id = ?').run(req.params.id);
    res.status(204).send();
  });

  return router;
}
