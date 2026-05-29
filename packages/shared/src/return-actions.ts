import { z } from 'zod';
import { EquipmentSchema } from './equipment';
import { QuestAcListSchema } from './quest';

export const RepostAdjustmentsSchema = z.object({
  acceptanceCriteria: QuestAcListSchema.optional(),
  edgeCases: QuestAcListSchema.optional(),
  equipment: EquipmentSchema.optional(),
});

export const RepostBodySchema = z.object({
  adjustments: RepostAdjustmentsSchema.optional(),
});

export const SplitChildSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().default(''),
  acceptanceCriteria: QuestAcListSchema,
});

export const SplitBodySchema = z.object({
  children: z.array(SplitChildSchema).min(2),
});

export const FeedbackBodySchema = z.object({
  text: z.string().min(1).max(2000),
});

export const FeedbackEntrySchema = z.object({
  text: z.string(),
  createdAt: z.string(),
});

export type RepostBody = z.infer<typeof RepostBodySchema>;
export type SplitChild = z.infer<typeof SplitChildSchema>;
export type SplitBody = z.infer<typeof SplitBodySchema>;
export type FeedbackBody = z.infer<typeof FeedbackBodySchema>;
export type FeedbackEntry = z.infer<typeof FeedbackEntrySchema>;
