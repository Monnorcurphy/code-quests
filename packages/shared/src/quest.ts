import { z } from 'zod';

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
  equipment: z.record(z.unknown()).default({}),
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
