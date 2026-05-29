import { Router } from 'express';
import Database from 'better-sqlite3';
import { EquipmentSchema } from '@code-quests/shared';
import type { AgentEvent } from '@code-quests/shared';
import {
  RepostBodySchema,
  SplitBodySchema,
  FeedbackBodySchema,
  FeedbackEntrySchema,
} from '@code-quests/shared';
import type { RepostBody, SplitBody, FeedbackBody } from '@code-quests/shared';
import { validate } from '../middleware/validate';

type Channel = {
  publishQuestEvent: (questId: string, event: AgentEvent) => void;
};

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

export function createQuestActionsRouter(
  db: Database.Database,
  getChannel: () => Channel | undefined = () => undefined,
): Router {
  const router = Router();

  router.post('/:questId/actions/repost', validate(RepostBodySchema), (req, res) => {
    const { questId } = req.params;
    const row = db.prepare('SELECT * FROM quests WHERE id = ?').get(questId) as QuestRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Quest not found' });
      return;
    }
    if (row.status !== 'returned_to_town') {
      res.status(409).json({
        error: `Quest cannot be reposted: current status is '${row.status}'. Only returned_to_town quests can be reposted.`,
        field: 'status',
      });
      return;
    }

    const { adjustments } = req.body as RepostBody;
    const sourceEquipment = EquipmentSchema.parse(JSON.parse(row.equipment_json));
    const newId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO quests
        (id, epic_id, title, description, acceptance_criteria_json, edge_cases_json,
         context, status, adventurer_id, equipment_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'idle', NULL, ?, ?, ?)`,
    ).run(
      newId,
      row.epic_id,
      row.title,
      row.description,
      JSON.stringify(
        adjustments?.acceptanceCriteria ?? (JSON.parse(row.acceptance_criteria_json) as string[]),
      ),
      JSON.stringify(
        adjustments?.edgeCases ?? (JSON.parse(row.edge_cases_json) as string[]),
      ),
      row.context,
      JSON.stringify(adjustments?.equipment ?? sourceEquipment),
      now,
      now,
    );

    const newRow = db.prepare('SELECT * FROM quests WHERE id = ?').get(newId) as QuestRow;

    const channel = getChannel();
    if (channel) {
      channel.publishQuestEvent(questId, {
        type: 'quest_reposted',
        timestamp: now,
        questId,
        newQuestId: newId,
      });
    }

    res.status(201).json(rowToApi(newRow));
  });

  router.post('/:questId/actions/retire', (req, res) => {
    const { questId } = req.params;
    const row = db.prepare('SELECT * FROM quests WHERE id = ?').get(questId) as QuestRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Quest not found' });
      return;
    }
    if (row.status === 'retired') {
      res.json(rowToApi(row));
      return;
    }
    if (row.status !== 'returned_to_town') {
      res.status(409).json({
        error: `Quest cannot be retired: current status is '${row.status}'. Only returned_to_town quests can be retired.`,
        field: 'status',
      });
      return;
    }

    const now = new Date().toISOString();
    db.prepare("UPDATE quests SET status = 'retired', updated_at = ? WHERE id = ?").run(
      now,
      questId,
    );

    const updated = db.prepare('SELECT * FROM quests WHERE id = ?').get(questId) as QuestRow;

    const channel = getChannel();
    if (channel) {
      channel.publishQuestEvent(questId, {
        type: 'quest_retired',
        timestamp: now,
        questId,
      });
    }

    res.json(rowToApi(updated));
  });

  router.post('/:questId/actions/split', validate(SplitBodySchema), (req, res) => {
    const { questId } = req.params;
    const row = db.prepare('SELECT * FROM quests WHERE id = ?').get(questId) as QuestRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Quest not found' });
      return;
    }
    if (row.status !== 'returned_to_town') {
      res.status(409).json({
        error: `Quest cannot be split: current status is '${row.status}'. Only returned_to_town quests can be split.`,
        field: 'status',
      });
      return;
    }

    const { children } = req.body as SplitBody;
    const now = new Date().toISOString();

    let epicId = row.epic_id;
    if (!epicId) {
      epicId = crypto.randomUUID();
      db.prepare('INSERT INTO epics (id, title, goal, created_at) VALUES (?, ?, ?, ?)').run(
        epicId,
        row.title,
        `Split from: ${row.title}`,
        now,
      );
    }

    const childIds: string[] = [];

    try {
      db.transaction(() => {
        for (const child of children) {
          const childId = crypto.randomUUID();
          childIds.push(childId);
          db.prepare(
            `INSERT INTO quests
              (id, epic_id, title, description, acceptance_criteria_json, edge_cases_json,
               context, status, equipment_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?, ?)`,
          ).run(
            childId,
            epicId,
            child.title,
            child.description,
            JSON.stringify(child.acceptanceCriteria),
            JSON.stringify([]),
            row.context,
            row.equipment_json,
            now,
            now,
          );
        }

        const currentSummary = row.failure_summary_json
          ? (JSON.parse(row.failure_summary_json) as Record<string, unknown>)
          : { recommendation: 'break_into_smaller', reason: '' };
        const updatedSummary = { ...currentSummary, splitIntoQuestIds: childIds };

        db.prepare(
          'UPDATE quests SET failure_summary_json = ?, updated_at = ? WHERE id = ?',
        ).run(JSON.stringify(updatedSummary), now, questId);
      })();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[quest-actions] POST /${questId}/actions/split failed: ${msg}\n`);
      res.status(500).json({ error: 'Failed to split quest' });
      return;
    }

    const childRows = childIds.map(
      (id) => rowToApi(db.prepare('SELECT * FROM quests WHERE id = ?').get(id) as QuestRow),
    );
    const updatedSource = db.prepare('SELECT * FROM quests WHERE id = ?').get(questId) as QuestRow;

    const channel = getChannel();
    if (channel) {
      channel.publishQuestEvent(questId, {
        type: 'quest_split',
        timestamp: now,
        questId,
        childQuestIds: childIds,
      });
    }

    res.status(201).json({
      originalQuest: rowToApi(updatedSource),
      childQuests: childRows,
    });
  });

  router.post('/:questId/actions/feedback', validate(FeedbackBodySchema), (req, res) => {
    const { questId } = req.params;
    const row = db.prepare('SELECT * FROM quests WHERE id = ?').get(questId) as QuestRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Quest not found' });
      return;
    }

    const { text } = req.body as FeedbackBody;
    const now = new Date().toISOString();

    const existing = row.user_feedback_json
      ? (JSON.parse(row.user_feedback_json) as unknown[])
      : [];
    const entry = FeedbackEntrySchema.parse({ text, createdAt: now });
    const updated = [...existing, entry];

    db.prepare('UPDATE quests SET user_feedback_json = ?, updated_at = ? WHERE id = ?').run(
      JSON.stringify(updated),
      now,
      questId,
    );

    const channel = getChannel();
    if (channel) {
      channel.publishQuestEvent(questId, {
        type: 'quest_feedback_added',
        timestamp: now,
        questId,
      });
    }

    res.json({ entry, feedbackCount: updated.length });
  });

  return router;
}
