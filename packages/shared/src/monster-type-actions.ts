import { z } from 'zod';

export const CreateMonsterTypeSchema = z.object({
  name: z.string().trim().min(1).max(60).regex(/[A-Za-z0-9]/, {
    message: 'Name must include at least one ASCII letter or digit',
  }),
  spritePath: z.string().min(1).max(500),
  defaultDifficulty: z.number().int().min(1).max(5),
  failureSignature: z.string().min(1).max(500),
}).superRefine((val, ctx) => {
  try { new RegExp(val.failureSignature); }
  catch {
    ctx.addIssue({
      code: 'custom',
      path: ['failureSignature'],
      message: 'Must be a valid JavaScript regular expression',
    });
  }
});

export type CreateMonsterTypeInput = z.infer<typeof CreateMonsterTypeSchema>;
