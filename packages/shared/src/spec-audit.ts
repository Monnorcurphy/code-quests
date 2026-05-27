import { z } from 'zod';

export const SpecGapBuildingSchema = z.enum([
  'war_room',
  'oracle',
  'library',
  'tavern',
  'armory',
  'guild_hall',
]);

export const SpecGapSeveritySchema = z.enum(['warn', 'block']);

export const SpecGapSchema = z.object({
  building: SpecGapBuildingSchema,
  reason: z.string().min(1).max(500),
  severity: SpecGapSeveritySchema,
});

export const SpecAuditSchema = z.object({
  runAt: z.string().min(1),
  gaps: z.array(SpecGapSchema),
  bypassed: z.boolean().default(false),
});

export type SpecGapBuilding = z.infer<typeof SpecGapBuildingSchema>;
export type SpecGapSeverity = z.infer<typeof SpecGapSeveritySchema>;
export type SpecGap = z.infer<typeof SpecGapSchema>;
export type SpecAudit = z.infer<typeof SpecAuditSchema>;
