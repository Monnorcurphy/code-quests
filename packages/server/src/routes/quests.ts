import { Router, Response } from 'express';
import Database from 'better-sqlite3';
import { z } from 'zod';
import {
  QuestStatusSchema,
  QuestSceneKeySchema,
  EquipmentSchema,
  SpecAuditSchema,
  QuestSchema,
  QuestAcListSchema,
  AdventurerSchema,
  AgentSchema,
  FailureSummarySchema,
  FailureSummaryRecommendationSchema,
  UserBlockerSchema,
} from '@code-quests/shared';
import type { AgentEvent, Monster, MonsterType } from '@code-quests/shared';
import { validate } from '../middleware/validate';
import { auditQuest } from '../audit/audit-quest';
import { getAuditAdapter } from '../agents/select-adapter';
import { autoMatchWithReason } from '../services/auto-match';
import { listMonsterTypes } from '../services/monster-types';
import { runQuest, getActiveHandle } from '../services/quest-runner';
import { transitionQuestStatus, InvalidTransitionError } from '../services/quest-status';
import { findAgentByQuest, endAgent } from '../services/agents-service';
import { advanceQuestScene } from '../services/quest-scene-progression';
import { setUserBlocker, getUserBlocker } from '../db/quest-repository';
import { getProject, touchProject } from '../db/project-repository';
import { frameUserBlocker } from '../services/adventure-framing';

const RespondInputBodySchema = z.object({
  text: z.string().min(1).max(4000),
});

const BlockQuestBodySchema = z.object({
  description: z.string().min(1).max(1000),
});

const CreateQuestSchema = z.object({
  title: z.string().min(1),
  epicId: z.string().min(1).nullable().default(null),
  projectId: z.string().min(1).nullable().default(null),
  modelId: z.string().min(1).nullable().default(null),
  description: z.string().default(''),
  acceptanceCriteria: QuestAcListSchema.default([]),
  edgeCases: QuestAcListSchema.default([]),
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
  project_id: string | null;
  model_id: string | null;
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
  input_request_json: string | null;
  user_blocker_json: string | null;
  current_scene: string;
  created_at: string;
  updated_at: string;
  ac_locked_at: string | null;
};

function rowToApi(row: QuestRow) {
  return {
    id: row.id,
    epicId: row.epic_id,
    projectId: row.project_id,
    modelId: row.model_id,
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
    inputRequest: row.input_request_json ? JSON.parse(row.input_request_json) : null,
    userBlocker: row.user_blocker_json ? JSON.parse(row.user_blocker_json) : null,
    currentScene: row.current_scene,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    acLockedAt: row.ac_locked_at,
  };
}

function assertReferenceExists(
  db: Database.Database,
  table: 'epics' | 'adventurers' | 'projects' | 'models',
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

function loadAdventurerRow(db: Database.Database, id: string) {
  const r = db.prepare('SELECT * FROM adventurers WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!r) return null;
  return AdventurerSchema.parse({
    id: r['id'],
    name: r['name'],
    class: r['class'],
    modelId: r['model_id'],
    createdAt: r['created_at'],
    stats: JSON.parse(r['stats_json'] as string),
    specializations: JSON.parse(r['specializations_json'] as string),
    scars: JSON.parse(r['scars_json'] as string),
  });
}

export function createQuestsRouter(
  db: Database.Database,
  getChannel: () => { publishQuestEvent: (questId: string, event: AgentEvent) => void } | undefined = () => undefined,
): Router {
  const router = Router();

  router.get('/active', (_req, res) => {
    // "Active" in the product sense = any in-progress state the Party Map needs to surface.
    // The founding doc (§Party Map) says the peek lists every adventurer who is currently on
    // a quest, regardless of whether the agent is mid-step (active), awaiting the user
    // (paused_input), or blocked by the user (user_blocked). Filtering on `status = 'active'`
    // hides paused/blocked quests and breaks parallel-quest navigation.
    const questRows = db.prepare(
      "SELECT q.*, a.id AS a_id, a.adventurer_id AS a_adv_id, a.started_at AS a_started_at, a.ended_at AS a_ended_at, a.pid AS a_pid, a.exit_code AS a_exit_code FROM quests q LEFT JOIN agents a ON a.quest_id = q.id AND a.ended_at IS NULL WHERE q.status IN ('active', 'paused_input', 'user_blocked') ORDER BY q.created_at",
    ).all() as (QuestRow & {
      a_id: string | null;
      a_adv_id: string | null;
      a_started_at: string | null;
      a_ended_at: string | null;
      a_pid: number | null;
      a_exit_code: number | null;
    })[];

    const result = questRows.map((row) => {
      const quest = rowToApi(row);
      const agent =
        row.a_id !== null
          ? AgentSchema.parse({
              id: row.a_id,
              adventurerId: row.a_adv_id,
              questId: row.id,
              startedAt: row.a_started_at,
              endedAt: row.a_ended_at ?? null,
              pid: row.a_pid ?? null,
              exitCode: row.a_exit_code ?? null,
            })
          : null;
      return { ...quest, agent };
    });
    res.json(result);
  });

  router.get('/', (_req, res) => {
    const rows = db.prepare('SELECT * FROM quests ORDER BY created_at').all() as QuestRow[];
    res.json(rows.map(rowToApi));
  });

  router.post('/', validate(CreateQuestSchema), (req, res) => {
    const body = req.body as CreateQuest;
    if (!assertReferenceExists(db, 'epics', body.epicId, 'epicId', res)) return;
    if (!assertReferenceExists(db, 'projects', body.projectId, 'projectId', res)) return;
    if (!assertReferenceExists(db, 'models', body.modelId, 'modelId', res)) return;
    if (!assertReferenceExists(db, 'adventurers', body.adventurerId, 'adventurerId', res)) return;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO quests
        (id, epic_id, project_id, model_id, title, description, acceptance_criteria_json, edge_cases_json,
         context, status, adventurer_id, agent_id, equipment_json, spec_audit_json,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      body.epicId,
      body.projectId,
      body.modelId,
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

  router.get('/returned', (req, res) => {
    const limit = Math.max(1, Math.min(100, Number(req.query['limit']) || 20));
    const offset = Math.max(0, Number(req.query['offset']) || 0);

    const countRow = db
      .prepare("SELECT COUNT(*) AS cnt FROM quests WHERE status IN ('complete', 'failed')")
      .get() as { cnt: number };

    type ReturnedRow = QuestRow & {
      adv_id: string | null;
      adv_name: string | null;
      adv_class: string | null;
      ag_id: string | null;
      ag_started_at: string | null;
      ag_ended_at: string | null;
      ag_events_json: string | null;
    };

    const rows = db
      .prepare(
        `SELECT q.*,
          adv.id AS adv_id, adv.name AS adv_name, adv.class AS adv_class,
          ag.id AS ag_id, ag.started_at AS ag_started_at,
          ag.ended_at AS ag_ended_at, ag.events_json AS ag_events_json
        FROM quests q
        LEFT JOIN agents ag ON ag.id = (
          SELECT id FROM agents WHERE quest_id = q.id ORDER BY started_at DESC LIMIT 1
        )
        LEFT JOIN adventurers adv ON adv.id = ag.adventurer_id
        WHERE q.status IN ('complete', 'failed')
        ORDER BY q.updated_at DESC
        LIMIT ? OFFSET ?`,
      )
      .all(limit, offset) as ReturnedRow[];

    const items = rows.map((row) => ({
      ...rowToApi(row),
      adventurer:
        row.adv_id !== null
          ? { id: row.adv_id, name: row.adv_name!, class: row.adv_class! }
          : null,
      agent:
        row.ag_id !== null
          ? {
              id: row.ag_id,
              startedAt: row.ag_started_at!,
              endedAt: row.ag_ended_at ?? null,
              events: JSON.parse(row.ag_events_json ?? '[]') as unknown[],
            }
          : null,
    }));

    res.json({ items, total: countRow.cnt, limit, offset });
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
    if (!assertReferenceExists(db, 'projects', body.projectId, 'projectId', res)) return;
    if (!assertReferenceExists(db, 'models', body.modelId, 'modelId', res)) return;
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
    if (body.projectId !== undefined) { cols.push('project_id = ?'); vals.push(body.projectId); }
    if (body.modelId !== undefined) { cols.push('model_id = ?'); vals.push(body.modelId); }
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

  router.get('/:id/auto-match', (req, res) => {
    const row = db.prepare('SELECT * FROM quests WHERE id = ?').get(req.params.id) as QuestRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Quest not found' });
      return;
    }

    const guildRows = db.prepare('SELECT * FROM adventurers ORDER BY created_at, id').all();
    const guild = (guildRows as Record<string, unknown>[]).map((r) =>
      AdventurerSchema.parse({
        id: r['id'],
        name: r['name'],
        class: r['class'],
        modelId: r['model_id'],
        createdAt: r['created_at'],
        stats: JSON.parse(r['stats_json'] as string),
        specializations: JSON.parse(r['specializations_json'] as string),
        scars: JSON.parse(r['scars_json'] as string),
      }),
    );
    const activeAgentRows = db.prepare('SELECT * FROM agents WHERE ended_at IS NULL').all();
    const activeAgents = (activeAgentRows as Record<string, unknown>[]).map((r) =>
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
    const monsterRows = db.prepare('SELECT id, type_id FROM monsters').all() as {
      id: string;
      type_id: string;
    }[];
    const monsters: Monster[] = monsterRows.map((r) => ({
      id: r.id,
      typeId: r.type_id,
      name: '',
      scope: 'project' as const,
      projectId: null,
    modelId: null,
      firstSeenAt: '',
      lastSeenAt: '',
      encounters: 0,
      defeats: 0,
      escapes: 0,
      calibratedDifficulty: 1,
      notes: '',
    }));
    const monsterTypes: MonsterType[] = listMonsterTypes(db).map((mt) => ({
      id: mt.id,
      name: mt.name,
      spritePath: mt.spritePath,
      defaultDifficulty: mt.defaultDifficulty,
      failureSignature: mt.failureSignature,
      createdBy: mt.createdBy as 'system' | 'user',
    }));

    const quest = QuestSchema.parse(rowToApi(row));
    const { adventurer, reason } = autoMatchWithReason(quest, guild, activeAgents, {
      monsters,
      monsterTypes,
    });

    res.json({
      adventurerId: adventurer?.id ?? null,
      adventurerName: adventurer?.name ?? null,
      adventurerClass: adventurer?.class ?? null,
      reason,
    });
  });

  router.post('/:id/dispatch', (req, res) => {
    const row = db.prepare('SELECT * FROM quests WHERE id = ?').get(req.params.id) as QuestRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Quest not found' });
      return;
    }
    if (row.status !== 'idle') {
      res.status(409).json({ error: 'Quest already dispatched' });
      return;
    }

    const DispatchBodySchema = z.object({
      adventurerId: z.string().min(1).optional(),
      bypass: z.boolean().optional(),
    });
    const bodyResult = DispatchBodySchema.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Invalid request body', details: bodyResult.error.issues });
      return;
    }
    const body = bodyResult.data;
    const bypass = req.query['bypass'] === 'true' || body.bypass === true;

    void (async () => {
      try {
        let chosenAdventurerId: string | null = row.adventurer_id;

        if (body.adventurerId !== undefined) {
          const exists = db.prepare('SELECT id FROM adventurers WHERE id = ?').get(body.adventurerId);
          if (!exists) {
            res.status(400).json({ error: 'adventurerId does not reference an existing adventurer', field: 'adventurerId' });
            return;
          }
          chosenAdventurerId = body.adventurerId;
        } else if (chosenAdventurerId === null) {
          const guildRows = db.prepare('SELECT * FROM adventurers ORDER BY created_at').all();
          const guild = (guildRows as Record<string, unknown>[]).map((r) =>
            AdventurerSchema.parse({
              id: r['id'],
              name: r['name'],
              class: r['class'],
              modelId: r['model_id'],
              createdAt: r['created_at'],
              stats: JSON.parse(r['stats_json'] as string),
              specializations: JSON.parse(r['specializations_json'] as string),
              scars: JSON.parse(r['scars_json'] as string),
            }),
          );
          const activeAgentRows = db.prepare('SELECT * FROM agents WHERE ended_at IS NULL').all();
          const activeAgents = (activeAgentRows as Record<string, unknown>[]).map((r) =>
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

          const monsterRows = db.prepare('SELECT id, type_id FROM monsters').all() as { id: string; type_id: string }[];
          const monsters: Monster[] = monsterRows.map((r) => ({
            id: r.id,
            typeId: r.type_id,
            name: '',
            scope: 'project' as const,
            projectId: null,
    modelId: null,
            firstSeenAt: '',
            lastSeenAt: '',
            encounters: 0,
            defeats: 0,
            escapes: 0,
            calibratedDifficulty: 1,
            notes: '',
          }));
          const monsterTypes: MonsterType[] = listMonsterTypes(db).map((mt) => ({
            id: mt.id,
            name: mt.name,
            spritePath: mt.spritePath,
            defaultDifficulty: mt.defaultDifficulty,
            failureSignature: mt.failureSignature,
            createdBy: mt.createdBy as 'system' | 'user',
          }));

          const quest = QuestSchema.parse(rowToApi(row));
          const { adventurer: matched } = autoMatchWithReason(quest, guild, activeAgents, {
            monsters,
            monsterTypes,
            logger: (entry) => { process.stdout.write(JSON.stringify(entry) + '\n'); },
          });
          if (matched === null) {
            res.status(409).json({
              error: 'No available adventurer — recruit one in the Town Square',
              code: 'NO_ADVENTURER',
            });
            return;
          }
          chosenAdventurerId = matched.id;
        }

        if (chosenAdventurerId !== row.adventurer_id) {
          const now = new Date().toISOString();
          db.prepare('UPDATE quests SET adventurer_id = ?, updated_at = ? WHERE id = ?')
            .run(chosenAdventurerId, now, req.params.id);
        }

        const updatedRow = db.prepare('SELECT * FROM quests WHERE id = ?').get(req.params.id) as QuestRow;
        const quest = QuestSchema.parse(rowToApi(updatedRow));
        const adapter = getAuditAdapter();
        const audit = await auditQuest(quest, adapter);
        const blockGaps = audit.gaps.filter((g) => g.severity === 'block');
        if (blockGaps.length > 0 && !bypass) {
          res.status(409).json({ error: 'Quest has blocking audit gaps — fix them or dispatch with ?bypass=true', audit });
          return;
        }
        const finalAudit = { ...audit, bypassed: bypass };
        const now = new Date().toISOString();
        db.prepare(
          'UPDATE quests SET status = ?, ac_locked_at = ?, spec_audit_json = ?, updated_at = ? WHERE id = ?',
        ).run('active', now, JSON.stringify(finalAudit), now, req.params.id);

        const adventurer = chosenAdventurerId ? loadAdventurerRow(db, chosenAdventurerId) : null;
        if (!adventurer) {
          res.status(500).json({ error: 'Failed to load adventurer for dispatch' });
          return;
        }

        const activeQuest = QuestSchema.parse(rowToApi(
          db.prepare('SELECT * FROM quests WHERE id = ?').get(req.params.id) as QuestRow,
        ));

        // Real-agent dispatch needs a project. Stub/offline adapters can run
        // without one (they don't spawn a subprocess). We only block when we'd
        // otherwise spawn a real Claude with no project scope.
        let projectCwd: string | undefined;
        if (activeQuest.projectId) {
          const project = getProject(db, activeQuest.projectId);
          if (!project) {
            res.status(409).json({
              error: 'Quest is linked to a project that no longer exists',
              code: 'PROJECT_MISSING',
            });
            return;
          }
          projectCwd = project.path;
          touchProject(db, project.id);
        } else if (process.env['CODE_QUESTS_USE_REAL_AGENT'] === '1') {
          res.status(409).json({
            error: 'Real-agent dispatch requires a project. Add one in Town Square and link it to this quest.',
            code: 'NO_PROJECT',
          });
          return;
        }

        const channel = getChannel();
        const { agent, done } = await runQuest(activeQuest, adventurer, {
          db,
          publishEvent: channel ? (questId, evt) => channel.publishQuestEvent(questId, evt) : undefined,
          cwd: projectCwd,
        });
        void done;

        const finalRow = db.prepare('SELECT * FROM quests WHERE id = ?').get(req.params.id) as QuestRow;
        res.json({ ...rowToApi(finalRow), agentId: agent.id });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[quests] POST /quests/:id/dispatch failed: ${msg}\n`);
        res.status(500).json({ error: 'Failed to dispatch quest' });
      }
    })();
  });

  router.post('/:id/complete', (req, res) => {
    const row = db.prepare('SELECT * FROM quests WHERE id = ?').get(req.params.id) as QuestRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Quest not found' });
      return;
    }
    if (row.status !== 'active') {
      res.status(409).json({ error: 'Quest must be active to complete manually' });
      return;
    }
    const BodySchema = z.object({ summary: z.string().optional() });
    const bodyResult = BodySchema.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Invalid request body', details: bodyResult.error.issues });
      return;
    }
    try {
      transitionQuestStatus(db, req.params.id, 'active', 'complete');
      const agent = findAgentByQuest(db, req.params.id);
      if (agent && agent.endedAt === null) {
        endAgent(db, agent.id, 0);
      }
      const updated = db.prepare('SELECT * FROM quests WHERE id = ?').get(req.params.id) as QuestRow;
      res.json(rowToApi(updated));
    } catch (err) {
      if (err instanceof InvalidTransitionError) {
        res.status(409).json({ error: err.message });
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[quests] POST /quests/:id/complete failed: ${msg}\n`);
      res.status(500).json({ error: 'Failed to complete quest' });
    }
  });

  router.post('/:id/fail', (req, res) => {
    const row = db.prepare('SELECT * FROM quests WHERE id = ?').get(req.params.id) as QuestRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Quest not found' });
      return;
    }
    if (row.status !== 'active') {
      res.status(409).json({ error: 'Quest must be active to fail manually' });
      return;
    }
    const BodySchema = z.object({
      summary: z.string().min(1),
      recommendation: FailureSummaryRecommendationSchema.optional(),
    });
    const bodyResult = BodySchema.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Invalid request body', details: bodyResult.error.issues });
      return;
    }
    const { summary, recommendation } = bodyResult.data;
    const failureSummary = FailureSummarySchema.parse({
      reason: summary,
      recommendation: recommendation ?? 'repost_with_clarification',
    });
    try {
      const now = new Date().toISOString();
      const result = db
        .prepare(
          "UPDATE quests SET status = 'failed', failure_summary_json = ?, updated_at = ? WHERE id = ? AND status = 'active'",
        )
        .run(JSON.stringify(failureSummary), now, req.params.id) as { changes: number };
      if (result.changes === 0) {
        res.status(409).json({ error: 'Quest must be active to fail manually' });
        return;
      }
      const agent = findAgentByQuest(db, req.params.id);
      if (agent && agent.endedAt === null) {
        endAgent(db, agent.id, 1);
      }
      const updated = db.prepare('SELECT * FROM quests WHERE id = ?').get(req.params.id) as QuestRow;
      res.json(rowToApi(updated));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[quests] POST /quests/:id/fail failed: ${msg}\n`);
      res.status(500).json({ error: 'Failed to fail quest' });
    }
  });

  router.post('/:id/cancel', (req, res) => {
    const row = db.prepare('SELECT * FROM quests WHERE id = ?').get(req.params.id) as QuestRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Quest not found' });
      return;
    }
    if (row.status !== 'active') {
      res.status(409).json({ error: 'Only active quests can be cancelled' });
      return;
    }
    const failureSummary = FailureSummarySchema.parse({
      reason: 'User cancelled',
      recommendation: 'retire',
    });
    try {
      const now = new Date().toISOString();
      const result = db
        .prepare(
          "UPDATE quests SET status = 'failed', failure_summary_json = ?, updated_at = ? WHERE id = ? AND status = 'active'",
        )
        .run(JSON.stringify(failureSummary), now, req.params.id) as { changes: number };
      if (result.changes === 0) {
        res.status(409).json({ error: 'Only active quests can be cancelled' });
        return;
      }
      const agent = findAgentByQuest(db, req.params.id);
      if (agent && agent.endedAt === null) {
        endAgent(db, agent.id, null);
      }
      const handle = getActiveHandle(req.params.id);
      if (handle) {
        void handle.cancel('user cancelled');
      }
      const updated = db.prepare('SELECT * FROM quests WHERE id = ?').get(req.params.id) as QuestRow;
      res.json(rowToApi(updated));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[quests] POST /quests/:id/cancel failed: ${msg}\n`);
      res.status(500).json({ error: 'Failed to cancel quest' });
    }
  });

  router.post('/:id/advance-scene', (req, res) => {
    const row = db.prepare('SELECT * FROM quests WHERE id = ?').get(req.params.id) as QuestRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Quest not found' });
      return;
    }

    const activeAgent = db
      .prepare('SELECT id FROM agents WHERE quest_id = ? AND ended_at IS NULL')
      .get(req.params.id);
    if (!activeAgent) {
      res.status(401).json({ error: 'No active agent for this quest' });
      return;
    }

    const BodySchema = z.object({ expectedFrom: QuestSceneKeySchema });
    const bodyResult = BodySchema.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Invalid request body', details: bodyResult.error.issues });
      return;
    }

    if (row.current_scene !== bodyResult.data.expectedFrom) {
      res.status(409).json({
        error: 'scene_state_mismatch',
        currentScene: row.current_scene,
      });
      return;
    }

    const transition = advanceQuestScene(db, req.params.id);
    if (!transition) {
      res.json({ currentScene: 'quest-boss-room', advanced: false });
      return;
    }

    const channel = getChannel();
    if (channel) {
      channel.publishQuestEvent(req.params.id, {
        type: 'scene_change',
        timestamp: new Date().toISOString(),
        from: transition.from,
        to: transition.to,
      });
    }

    res.json({ currentScene: transition.to, advanced: true });
  });

  router.post('/:id/respond-input', validate(RespondInputBodySchema), (req, res) => {
    const row = db.prepare('SELECT * FROM quests WHERE id = ?').get(req.params.id) as QuestRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Quest not found' });
      return;
    }
    if (row.status !== 'paused_input') {
      res.status(409).json({ error: 'Quest is not awaiting input' });
      return;
    }
    const handle = getActiveHandle(req.params.id);
    if (!handle) {
      res.status(410).json({ error: 'Agent is no longer active — quest is stale' });
      return;
    }
    const body = req.body as { text: string };
    void (async () => {
      try {
        await handle.respond(body.text);
        // Return current state; actual status transition + clearInputRequest happen in quest-runner
        // when the adapter emits the resumed event.
        const updated = db.prepare('SELECT * FROM quests WHERE id = ?').get(req.params.id) as QuestRow;
        res.json(rowToApi(updated));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[quests] POST /quests/:id/respond-input failed: ${msg}\n`);
        res.status(500).json({ error: 'Failed to respond to input request' });
      }
    })();
  });

  router.post('/:id/block', validate(BlockQuestBodySchema), (req, res) => {
    const row = db.prepare('SELECT * FROM quests WHERE id = ?').get(req.params.id) as QuestRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Quest not found' });
      return;
    }
    if (row.status !== 'active' && row.status !== 'paused_input') {
      res.status(409).json({ error: 'Quest must be active or awaiting input to block' });
      return;
    }
    const body = req.body as { description: string };
    try {
      const now = new Date().toISOString();
      transitionQuestStatus(db, req.params.id, row.status, 'user_blocked');
      setUserBlocker(db, req.params.id, { rawDescription: body.description, markedAt: now });

      // Cancel the active agent so it stops working while the user gathers external information.
      // The agent is reborn when the user unblocks via the unblock route, which calls runQuest again.
      const handle = getActiveHandle(req.params.id);
      if (handle) {
        void handle.cancel('user_blocked');
      }

      const channel = getChannel();
      if (channel) {
        channel.publishQuestEvent(req.params.id, {
          type: 'status_change',
          timestamp: now,
          from: row.status as 'active' | 'paused_input',
          to: 'user_blocked',
        });
      }

      const updatedRow = db.prepare('SELECT * FROM quests WHERE id = ?').get(req.params.id) as QuestRow;
      const adventurerId = updatedRow.adventurer_id;

      // Async framing — same fire-and-forget pattern as adventure-framing in quest-runner.
      // The raw description renders immediately; framing updates the DB once the haiku call resolves.
      if (adventurerId) {
        const capturedDescription = body.description;
        const capturedAdventurerId = adventurerId;
        const capturedNow = now;
        void (async () => {
          try {
            const adventurer = loadAdventurerRow(db, capturedAdventurerId);
            if (!adventurer) return;
            const adventureFraming = await frameUserBlocker(capturedDescription, adventurer.name);
            // Gate: discard framing if the quest moved past user_blocked (e.g. user unblocked).
            const currentBlocker = getUserBlocker(db, req.params.id);
            if (!currentBlocker || currentBlocker.markedAt !== capturedNow) return;
            if (currentBlocker.unblockedAt) return;
            setUserBlocker(db, req.params.id, {
              ...currentBlocker,
              adventureFraming,
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            process.stderr.write(`[quests] framing update error for quest ${req.params.id}: ${msg}\n`);
          }
        })();
      }

      res.json(rowToApi(updatedRow));
    } catch (err) {
      if (err instanceof InvalidTransitionError) {
        res.status(409).json({ error: err.message });
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[quests] POST /quests/:id/block failed: ${msg}\n`);
      res.status(500).json({ error: 'Failed to block quest' });
    }
  });

  router.post('/:id/unblock', (req, res) => {
    const row = db.prepare('SELECT * FROM quests WHERE id = ?').get(req.params.id) as QuestRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Quest not found' });
      return;
    }
    if (row.status !== 'user_blocked') {
      res.status(409).json({ error: 'Quest is not blocked' });
      return;
    }
    void (async () => {
      try {
        const now = new Date().toISOString();
        if (!row.user_blocker_json) {
          res.status(500).json({ error: 'Quest is blocked but has no blocker record' });
          return;
        }
        const existingBlocker = UserBlockerSchema.parse(JSON.parse(row.user_blocker_json));
        setUserBlocker(db, req.params.id, { ...existingBlocker, unblockedAt: now });
        transitionQuestStatus(db, req.params.id, 'user_blocked', 'active');

        const channel = getChannel();
        if (channel) {
          channel.publishQuestEvent(req.params.id, {
            type: 'status_change',
            timestamp: now,
            from: 'user_blocked',
            to: 'active',
          });
        }

        const updatedRow = db.prepare('SELECT * FROM quests WHERE id = ?').get(req.params.id) as QuestRow;
        const quest = QuestSchema.parse(rowToApi(updatedRow));
        const adventurerId = quest.adventurerId;
        if (!adventurerId) {
          res.status(409).json({ error: 'Quest has no adventurer assigned — cannot respawn agent' });
          return;
        }
        const adventurer = loadAdventurerRow(db, adventurerId);
        if (!adventurer) {
          res.status(500).json({ error: 'Failed to load adventurer for respawn' });
          return;
        }

        const { done } = await runQuest(quest, adventurer, {
          db,
          publishEvent: channel ? (questId, evt) => channel.publishQuestEvent(questId, evt) : undefined,
        });
        void done;

        const finalRow = db.prepare('SELECT * FROM quests WHERE id = ?').get(req.params.id) as QuestRow;
        res.json(rowToApi(finalRow));
      } catch (err) {
        if (err instanceof InvalidTransitionError) {
          res.status(409).json({ error: err.message });
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[quests] POST /quests/:id/unblock failed: ${msg}\n`);
        res.status(500).json({ error: 'Failed to unblock quest' });
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
