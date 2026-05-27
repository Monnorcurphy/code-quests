import { z } from 'zod';

export const EquipmentSchema = z.object({
  skillIds: z.array(z.string()).default([]),
  toolIds: z.array(z.string()).default([]),
  mcpServerIds: z.array(z.string()).default([]),
});

export type Equipment = z.infer<typeof EquipmentSchema>;

export const SkillStatusSchema = z.enum(['candidate', 'active', 'retired']);
export const SkillCreatedBySchema = z.enum(['system', 'user']);

export const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  monsterTypeIds: z.array(z.string()),
  status: SkillStatusSchema,
  createdBy: SkillCreatedBySchema,
  createdAt: z.string(),
  hitCount: z.number().int().nonnegative(),
  implementation: z.string(),
});

export type Skill = z.infer<typeof SkillSchema>;

export const ToolSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  invocation: z.string(),
});

export type Tool = z.infer<typeof ToolSchema>;

export const MCPServerSchema = z.object({
  id: z.string(),
  name: z.string(),
  config: z.record(z.unknown()),
});

export type MCPServer = z.infer<typeof MCPServerSchema>;
