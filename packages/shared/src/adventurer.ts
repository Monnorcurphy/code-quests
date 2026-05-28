import { z } from 'zod';

export const AdventurerClassSchema = z.enum([
  'champion',
  'ranger',
  'scout',
  'rogue',
  'apprentice',
]);

export type AdventurerClass = z.infer<typeof AdventurerClassSchema>;

export const ScarRecordSchema = z.object({
  questId: z.string().min(1),
  failureSummary: z.string(),
  monsterIdAtFatal: z.string(),
  occurredAt: z.string(),
});

export type ScarRecord = z.infer<typeof ScarRecordSchema>;

export const AdventurerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  class: AdventurerClassSchema,
  modelId: z.string().min(1),
  createdAt: z.string(),
  stats: z.record(z.unknown()).default({}),
  specializations: z.array(z.string()).default([]),
  scars: z.array(ScarRecordSchema).default([]),
});

export type Adventurer = z.infer<typeof AdventurerSchema>;
