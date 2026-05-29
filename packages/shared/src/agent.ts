import { z } from 'zod';
import { QuestStatusSchema, QuestSceneKeySchema, FailureSummarySchema } from './quest';

export const AgentSchema = z.object({
  id: z.string().min(1),
  adventurerId: z.string().min(1),
  questId: z.string().min(1),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  pid: z.number().int().nullable(),
  exitCode: z.number().int().nullable(),
});

export type Agent = z.infer<typeof AgentSchema>;

export const AgentEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('progress'),
    timestamp: z.string(),
    message: z.string(),
  }),
  z.object({
    type: z.literal('combat'),
    timestamp: z.string(),
    monsterTypeId: z.string().optional(),
    message: z.string(),
  }),
  z.object({
    type: z.literal('status_change'),
    timestamp: z.string(),
    from: QuestStatusSchema,
    to: QuestStatusSchema,
  }),
  z.object({
    type: z.literal('log'),
    timestamp: z.string(),
    message: z.string(),
  }),
  z.object({
    type: z.literal('completed'),
    timestamp: z.string(),
    summary: z.string().optional(),
  }),
  z.object({
    type: z.literal('failed'),
    timestamp: z.string(),
    reason: z.string().optional(),
  }),
  z.object({
    type: z.literal('scene_change'),
    timestamp: z.string(),
    from: QuestSceneKeySchema,
    to: QuestSceneKeySchema,
  }),
  z.object({
    type: z.literal('monster_appeared'),
    timestamp: z.string(),
    encounterId: z.string(),
    monsterId: z.string(),
    monsterName: z.string(),
    monsterTypeId: z.string(),
    spritePath: z.string(),
    difficulty: z.number().int().min(1).max(5),
  }),
  z.object({
    type: z.literal('monster_resolved'),
    timestamp: z.string(),
    encounterId: z.string(),
    outcome: z.enum(['victory', 'defeat', 'escape']),
  }),
  z.object({
    type: z.literal('paused_input'),
    timestamp: z.string(),
    question: z.string().min(1),
    context: z.string().optional(),
    adventureFraming: z.string().optional(),
  }),
  z.object({
    type: z.literal('resumed'),
    timestamp: z.string(),
    source: z.enum(['input_response', 'user_unblock']),
  }),
  z.object({
    type: z.literal('quest_returned'),
    timestamp: z.string(),
    questId: z.string(),
    failureSummary: FailureSummarySchema,
    scarAdded: z.boolean(),
  }),
  z.object({
    type: z.literal('quest_reposted'),
    timestamp: z.string(),
    questId: z.string(),
    newQuestId: z.string(),
  }),
  z.object({
    type: z.literal('quest_retired'),
    timestamp: z.string(),
    questId: z.string(),
  }),
  z.object({
    type: z.literal('quest_split'),
    timestamp: z.string(),
    questId: z.string(),
    childQuestIds: z.array(z.string()),
  }),
  z.object({
    type: z.literal('quest_feedback_added'),
    timestamp: z.string(),
    questId: z.string(),
  }),
]);

export type AgentEvent = z.infer<typeof AgentEventSchema>;
