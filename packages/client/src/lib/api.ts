import { z } from 'zod';
import {
  AdventurerSchema,
  AdventurerClassSchema,
  QuestSchema,
  QuestStatusSchema,
  EpicSchema,
  SkillSchema,
  ToolSchema,
  MCPServerSchema,
  SpecAuditSchema,
  AgentEventSchema,
} from '@code-quests/shared';
import type { Equipment, AgentEvent, AdventurerClass, QuestStatus, FailureSummaryRecommendation } from '@code-quests/shared';

const ReturnedAgentSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  events: z.array(AgentEventSchema),
});

const ReturnedAdventurerSchema = z.object({
  id: z.string(),
  name: z.string(),
  class: AdventurerClassSchema,
});

// Use required fields (no .default()) to avoid Zod v3 addQuestionMarks making them optional
const ReturnedQuestBaseSchema = z.object({
  id: z.string(),
  epicId: z.string().nullable(),
  title: z.string(),
  description: z.string(),
  acceptanceCriteria: z.array(z.string()),
  edgeCases: z.array(z.string()),
  context: z.string(),
  status: QuestStatusSchema,
  adventurerId: z.string().nullable(),
  agentId: z.string().nullable(),
  failureSummary: z.object({
    reason: z.string(),
    recommendation: z.enum(['retry', 'repost_with_clarification', 'retire']),
  }).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  adventurer: ReturnedAdventurerSchema.nullable(),
  agent: ReturnedAgentSchema.nullable(),
});

export const ReturnedQuestSchema = ReturnedQuestBaseSchema;

const ReturnedQuestsPageSchema = z.object({
  items: z.array(ReturnedQuestSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

export type ReturnedAdventurer = { id: string; name: string; class: AdventurerClass };
export type ReturnedAgent = { id: string; startedAt: string; endedAt: string | null; events: AgentEvent[] };
export type ReturnedQuestFailureSummary = { reason: string; recommendation: FailureSummaryRecommendation };
export type ReturnedQuest = {
  id: string;
  epicId: string | null;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  edgeCases: string[];
  context: string;
  status: QuestStatus;
  adventurerId: string | null;
  agentId: string | null;
  failureSummary: ReturnedQuestFailureSummary | null;
  createdAt: string;
  updatedAt: string;
  adventurer: ReturnedAdventurer | null;
  agent: ReturnedAgent | null;
};
export type ReturnedQuestsPage = z.infer<typeof ReturnedQuestsPageSchema>;

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
  acceptanceCriteria?: string[];
  edgeCases?: string[];
  context?: string;
};

export const api = {
  adventurers: {
    list: () => fetchJson(z.array(AdventurerSchema), '/adventurers'),
    create: (input: CreateAdventurerInput) =>
      postJson(AdventurerSchema, '/adventurers', input),
  },
  quests: {
    list: () => fetchJson(z.array(QuestSchema), '/quests'),
    active: () => fetchJson(z.array(QuestSchema), '/quests/active'),
    get: (id: string) => fetchJson(QuestSchema, `/quests/${id}`),
    create: (input: CreateQuestInput) =>
      postJson(QuestSchema, '/quests', input),
    patch: (id: string, body: PatchQuestInput) =>
      patchJson(QuestSchema, `/quests/${id}`, body),
    audit: (id: string) =>
      postJson(SpecAuditSchema, `/quests/${id}/audit`, {}),
    dispatch: (id: string, bypass = false) =>
      postJson(QuestSchema, `/quests/${id}/dispatch${bypass ? '?bypass=true' : ''}`, {}),
    cancel: (id: string) =>
      postJson(QuestSchema, `/quests/${id}/cancel`, {}),
    returned: (opts?: { limit?: number; offset?: number }) =>
      fetchJson(
        ReturnedQuestsPageSchema,
        `/quests/returned?limit=${opts?.limit ?? 20}&offset=${opts?.offset ?? 0}`,
      ),
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
