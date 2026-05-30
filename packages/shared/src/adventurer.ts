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

export const TUNIC_COLORS = ['green', 'blue', 'red', 'gold', 'purple', 'brown'] as const;
export const HAIR_COLORS = ['brown', 'blonde', 'black', 'red', 'silver'] as const;
export const SKIN_TONES = ['fair', 'olive', 'tan', 'brown', 'dark'] as const;
export const HAIR_STYLES = ['short', 'long', 'shaved', 'bun', 'ponytail'] as const;

export const TunicColorSchema = z.enum(TUNIC_COLORS);
export const HairColorSchema = z.enum(HAIR_COLORS);
export const SkinToneSchema = z.enum(SKIN_TONES);
export const HairStyleSchema = z.enum(HAIR_STYLES);

export type TunicColor = z.infer<typeof TunicColorSchema>;
export type HairColor = z.infer<typeof HairColorSchema>;
export type SkinTone = z.infer<typeof SkinToneSchema>;
export type HairStyle = z.infer<typeof HairStyleSchema>;

export const AdventurerStyleSchema = z.object({
  tunic: TunicColorSchema.optional(),
  hair: HairColorSchema.optional(),
  skin: SkinToneSchema.optional(),
  hairStyle: HairStyleSchema.optional(),
});

export type AdventurerStyle = z.infer<typeof AdventurerStyleSchema>;

export const AdventurerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  class: AdventurerClassSchema,
  modelId: z.string().min(1),
  createdAt: z.string(),
  stats: z.record(z.unknown()).default({}),
  specializations: z.array(z.string()).default([]),
  scars: z.array(ScarRecordSchema).default([]),
  style: AdventurerStyleSchema.optional(),
});

export type Adventurer = z.infer<typeof AdventurerSchema>;
