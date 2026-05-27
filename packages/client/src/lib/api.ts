import { z } from 'zod';
import {
  AdventurerSchema,
  AdventurerClassSchema,
  QuestSchema,
  EpicSchema,
  SkillSchema,
  ToolSchema,
  MCPServerSchema,
  SpecAuditSchema,
} from '@code-quests/shared';
import type { Equipment } from '@code-quests/shared';

const BASE_URL = ''; // same-origin via Vite proxy

const ApiErrorBodySchema = z.object({
  error: z.string(),
  field: z.string().optional(),
});

export class ApiError extends Error {
  field?: string;
  status: number;
  data?: unknown;

  constructor(message: string, opts: { field?: string; status: number; data?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.field = opts.field;
    this.status = opts.status;
    this.data = opts.data;
  }
}

async function fetchJson<T>(schema: z.ZodType<T>, path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  const data: unknown = await res.json();
  return schema.parse(data);
}

async function postJson<T>(schema: z.ZodType<T>, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const raw: unknown = await res.json().catch(() => ({ error: `${res.statusText}` }));
    const parsed = ApiErrorBodySchema.safeParse(raw);
    const msg = parsed.success ? parsed.data.error : `${res.status} ${res.statusText}`;
    const field = parsed.success ? parsed.data.field : undefined;
    throw new ApiError(msg, { field, status: res.status, data: raw });
  }
  const data: unknown = await res.json();
  return schema.parse(data);
}

async function patchJson<T>(schema: z.ZodType<T>, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const raw: unknown = await res.json().catch(() => ({ error: `${res.statusText}` }));
    const parsed = ApiErrorBodySchema.safeParse(raw);
    const msg = parsed.success ? parsed.data.error : `${res.status} ${res.statusText}`;
    const field = parsed.success ? parsed.data.field : undefined;
    throw new ApiError(msg, { field, status: res.status });
  }
  const data: unknown = await res.json();
  return schema.parse(data);
}

const CreateAdventurerInputSchema = z.object({
  name: z.string().min(1),
  class: AdventurerClassSchema,
  modelId: z.string().min(1),
});

export type CreateAdventurerInput = z.infer<typeof CreateAdventurerInputSchema>;

const CreateQuestInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  acceptanceCriteria: z.array(z.string()).optional(),
  epicId: z.string().nullable().optional(),
});

export type CreateQuestInput = z.infer<typeof CreateQuestInputSchema>;

export type PatchQuestInput = {
  equipment?: Equipment;
};

export const api = {
  adventurers: {
    list: () => fetchJson(z.array(AdventurerSchema), '/adventurers'),
    create: (input: CreateAdventurerInput) =>
      postJson(AdventurerSchema, '/adventurers', input),
  },
  quests: {
    list: () => fetchJson(z.array(QuestSchema), '/quests'),
    get: (id: string) => fetchJson(QuestSchema, `/quests/${id}`),
    create: (input: CreateQuestInput) =>
      postJson(QuestSchema, '/quests', input),
    patch: (id: string, body: PatchQuestInput) =>
      patchJson(QuestSchema, `/quests/${id}`, body),
    audit: (id: string) =>
      postJson(SpecAuditSchema, `/quests/${id}/audit`, {}),
    dispatch: (id: string, bypass = false) =>
      postJson(QuestSchema, `/quests/${id}/dispatch${bypass ? '?bypass=true' : ''}`, {}),
  },
  epics: {
    list: () => fetchJson(z.array(EpicSchema), '/epics'),
  },
  equipment: {
    skills: () => fetchJson(z.array(SkillSchema), '/skills'),
    tools: () => fetchJson(z.array(ToolSchema), '/tools'),
    mcpServers: () => fetchJson(z.array(MCPServerSchema), '/mcp-servers'),
  },
};
