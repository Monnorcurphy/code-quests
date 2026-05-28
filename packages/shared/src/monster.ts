import { z } from 'zod';

export const MonsterScopeSchema = z.enum(['project', 'guild']);
export type MonsterScope = z.infer<typeof MonsterScopeSchema>;

export const MonsterTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  spritePath: z.string(),
  defaultDifficulty: z.number().int().min(1).max(5),
  failureSignature: z.string(),
  createdBy: z.enum(['system', 'user']),
});
export type MonsterType = z.infer<typeof MonsterTypeSchema>;

export const MonsterSchema = z.object({
  id: z.string(),
  typeId: z.string(),
  name: z.string(),
  scope: MonsterScopeSchema,
  projectId: z.string().nullable(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  encounters: z.number().int(),
  defeats: z.number().int(),
  escapes: z.number().int(),
  calibratedDifficulty: z.number().int(),
  notes: z.string(),
});
export type Monster = z.infer<typeof MonsterSchema>;

export const MonsterEncounterSchema = z.object({
  id: z.string(),
  monsterId: z.string(),
  questId: z.string(),
  appearedAt: z.string(),
  combatLog: z.array(z.unknown()),
  outcome: z.enum(['victory', 'defeat', 'escape']),
  loot: z.array(z.unknown()),
});
export type MonsterEncounter = z.infer<typeof MonsterEncounterSchema>;
