import { z } from 'zod';
import { EquipmentSchema } from './equipment';
import { SpecAuditSchema } from './spec-audit';

export const QuestSceneKeySchema = z.enum([
  'quest-forest',
  'quest-cave',
  'quest-dungeon',
  'quest-boss-room',
]);

export type QuestSceneKey = z.infer<typeof QuestSceneKeySchema>;

export const FailureSummaryRecommendationSchema = z.enum([
  'retry',
  'repost_with_clarification',
  'retire',
]);
export type FailureSummaryRecommendation = z.infer<typeof FailureSummaryRecommendationSchema>;

export const FailureSummarySchema = z.object({
  reason: z.string().default(''),
  recommendation: FailureSummaryRecommendationSchema,
});
export type FailureSummary = z.infer<typeof FailureSummarySchema>;

export const AC_MAX_LENGTH = 500;
export const AC_MAX_COUNT = 15;
export const QuestAcItemSchema = z.string().trim().min(1).max(AC_MAX_LENGTH);
export const QuestAcListSchema = z.array(QuestAcItemSchema).max(AC_MAX_COUNT);

export const QuestStatusSchema = z.enum([
  'idle',
  'active',
  'complete',
  'failed',
  'paused_input',
  'user_blocked',
]);

export type QuestStatus = z.infer<typeof QuestStatusSchema>;

export const QuestSchema = z.object({
  id: z.string().min(1),
  epicId: z.string().min(1).nullable(),
  title: z.string().min(1),
  description: z.string().default(''),
  acceptanceCriteria: z.array(z.string()).default([]),
  edgeCases: z.array(z.string()).default([]),
  context: z.string().default(''),
  status: QuestStatusSchema.default('idle'),
  adventurerId: z.string().min(1).nullable(),
  agentId: z.string().nullable(),
  equipment: EquipmentSchema.default({ skillIds: [], toolIds: [], mcpServerIds: [] }),
  specAudit: SpecAuditSchema.nullable().default(null),
  failureSummary: FailureSummarySchema.nullable().default(null),
  currentScene: QuestSceneKeySchema.default('quest-forest'),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Quest = z.infer<typeof QuestSchema>;

export const EpicSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  goal: z.string().min(1),
  createdAt: z.string(),
});

export type Epic = z.infer<typeof EpicSchema>;
