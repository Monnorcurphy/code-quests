import { z } from 'zod';

export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  path: z.string().min(1),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});

export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  path: z.string().trim().min(1).max(1024),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
