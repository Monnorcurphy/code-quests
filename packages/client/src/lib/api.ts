import { z } from 'zod';
import {
  AdventurerSchema,
  AdventurerClassSchema,
  QuestSchema,
  QuestSceneKeySchema,
  QuestStatusSchema,
  FailureSummarySchema,
  EpicSchema,
  SkillSchema,
  ToolSchema,
  MCPServerSchema,
  SpecAuditSchema,
  AgentEventSchema,
  MonsterTypeSchema,
  MonsterSchema,
  MonsterEncounterSchema,
} from '@code-quests/shared';
import type { Equipment, AgentEvent, AdventurerClass, QuestStatus, FailureSummary, FailureSummaryRecommendation, QuestSceneKey, MonsterType, Monster, MonsterEncounter, MonsterScope, SplitChild } from '@code-quests/shared';

const FeedbackSuccessSchema = z.object({}).passthrough();

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
    recommendation: z.enum(['retry', 'repost_with_clarification', 'retire', 'break_into_smaller', 'level_up_first']),
    reason: z.string().default(''),
    fatalEncounterId: z.string().optional(),
    retries: z.number().optional(),
    notes: z.string().optional(),
    userFeedback: z.string().optional(),
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
export type ReturnedQuestFailureSummary = {
  reason: string;
  fatalEncounterId?: string;
  retries?: number;
  notes?: string;
  recommendation: FailureSummaryRecommendation;
  userFeedback?: string;
};
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

async function fetchJson<S extends z.ZodTypeAny>(schema: S, path: string): Promise<z.output<S>> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    const raw: unknown = await res.json().catch(() => ({ error: `${res.statusText}` }));
    const parsed = ApiErrorBodySchema.safeParse(raw);
    const msg = parsed.success ? parsed.data.error : `${res.status} ${res.statusText}`;
    const field = parsed.success ? parsed.data.field : undefined;
    throw new ApiError(msg, { field, status: res.status, data: raw });
  }
  const data: unknown = await res.json();
  return schema.parse(data) as z.output<S>;
}

async function postJson<S extends z.ZodTypeAny>(schema: S, path: string, body: unknown): Promise<z.output<S>> {
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
  return schema.parse(data) as z.output<S>;
}

async function patchJson<S extends z.ZodTypeAny>(schema: S, path: string, body: unknown): Promise<z.output<S>> {
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
  return schema.parse(data) as z.output<S>;
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

const AdvanceSceneResponseSchema = z.object({
  currentScene: QuestSceneKeySchema,
  advanced: z.boolean(),
});

export type AdvanceSceneResponse = z.infer<typeof AdvanceSceneResponseSchema>;

const FatalMonsterSchema = z.object({
  monsterId: z.string(),
  monsterName: z.string(),
  spritePath: z.string(),
  difficulty: z.number(),
});

export const HallOfReturnsQuestSchema = z.object({
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
  failureSummary: FailureSummarySchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  adventurer: z.object({
    id: z.string(),
    name: z.string(),
    class: AdventurerClassSchema,
  }).nullable(),
  fatalMonster: FatalMonsterSchema.nullable(),
}).passthrough();

const HallOfReturnsListSchema = z.object({
  items: z.array(HallOfReturnsQuestSchema),
  nextCursor: z.string().nullable(),
});

const PostMortemAttemptSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  events: z.array(AgentEventSchema),
});

const PostMortemAdventurerSchema = z.object({
  id: z.string(),
  name: z.string(),
  class: AdventurerClassSchema,
});

export const PostMortemResponseSchema = z.object({
  quest: HallOfReturnsQuestSchema,
  attempts: z.array(PostMortemAttemptSchema),
  encounters: z.array(MonsterEncounterSchema),
  failureSummary: FailureSummarySchema.nullable(),
  adventurer: PostMortemAdventurerSchema.nullable(),
});

export type HallOfReturnsQuest = z.infer<typeof HallOfReturnsQuestSchema>;
export type HallOfReturnsList = z.infer<typeof HallOfReturnsListSchema>;
export type FatalMonster = z.infer<typeof FatalMonsterSchema>;
export type PostMortemResponse = z.infer<typeof PostMortemResponseSchema>;
export type PostMortemAttempt = z.infer<typeof PostMortemAttemptSchema>;

// Re-export FailureSummary type for convenience
export type { FailureSummary };

const RepostResultSchema = z.object({
  newQuestId: z.string(),
  newTitle: z.string(),
}).passthrough();

const SplitResultSchema = z.object({
  questIds: z.array(z.string()),
  titles: z.array(z.string()),
}).passthrough();

export type RepostResult = z.infer<typeof RepostResultSchema>;
export type SplitResult = z.infer<typeof SplitResultSchema>;

export const api = {
  adventurers: {
    list: () => fetchJson(z.array(AdventurerSchema), '/adventurers'),
    get: (id: string) => fetchJson(AdventurerSchema, `/adventurers/${id}`),
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
    advanceScene: (id: string, expectedFrom: QuestSceneKey) =>
      postJson(AdvanceSceneResponseSchema, `/quests/${id}/advance-scene`, { expectedFrom }),
    block: (id: string, description: string) =>
      postJson(QuestSchema, `/quests/${id}/block`, { description }),
    unblock: (id: string) =>
      postJson(QuestSchema, `/quests/${id}/unblock`, {}),
    respondInput: (id: string, text: string) =>
      postJson(QuestSchema, `/quests/${id}/respond-input`, { text }),
    returned: (opts?: { limit?: number; offset?: number }) =>
      fetchJson(
        ReturnedQuestsPageSchema,
        `/quests/returned?limit=${opts?.limit ?? 20}&offset=${opts?.offset ?? 0}`,
      ),
    submitFeedback: (id: string, text: string) =>
      postJson(FeedbackSuccessSchema, `/quests/${id}/actions/feedback`, { text }),
    repost: (id: string, adjustments?: { acceptanceCriteria?: string[]; edgeCases?: string[] }) =>
      postJson(RepostResultSchema, `/quests/${id}/actions/repost`, { adjustments }),
    retire: (id: string) =>
      postJson(z.object({}).passthrough(), `/quests/${id}/actions/retire`, {}),
    split: (id: string, children: SplitChild[]) =>
      postJson(SplitResultSchema, `/quests/${id}/actions/split`, { children }),
  },
  epics: {
    list: () => fetchJson(z.array(EpicSchema), '/epics'),
  },
  equipment: {
    skills: () => fetchJson(z.array(SkillSchema), '/skills'),
    tools: () => fetchJson(z.array(ToolSchema), '/tools'),
    mcpServers: () => fetchJson(z.array(MCPServerSchema), '/mcp-servers'),
  },
  monsters: {
    listTypes: (): Promise<MonsterType[]> =>
      fetchJson(z.array(MonsterTypeSchema), '/monster-types'),
    list: (opts?: { scope?: MonsterScope; typeId?: string }): Promise<Monster[]> => {
      const params = new URLSearchParams();
      if (opts?.scope !== undefined) params.set('scope', opts.scope);
      if (opts?.typeId !== undefined) params.set('typeId', opts.typeId);
      const qs = params.toString();
      return fetchJson(z.array(MonsterSchema), `/monsters${qs ? `?${qs}` : ''}`);
    },
    get: (id: string): Promise<Monster> =>
      fetchJson(MonsterSchema, `/monsters/${id}`),
    listEncounters: (monsterId: string): Promise<MonsterEncounter[]> =>
      fetchJson(z.array(MonsterEncounterSchema), `/monsters/${monsterId}/encounters`),
    listQuestEncounters: (questId: string): Promise<MonsterEncounter[]> =>
      fetchJson(z.array(MonsterEncounterSchema), `/quests/${questId}/encounters`),
    promoteNemesis: (id: string, name?: string): Promise<Monster> =>
      postJson(MonsterSchema, `/monsters/${id}/promote-nemesis`, name !== undefined ? { name } : {}),
  },
  hallOfReturns: {
    listQuests: (opts?: { status?: 'returned_to_town' | 'complete'; cursor?: string; limit?: number }) => {
      const params = new URLSearchParams();
      params.set('status', opts?.status ?? 'returned_to_town');
      params.set('limit', String(opts?.limit ?? 20));
      if (opts?.cursor) params.set('cursor', opts.cursor);
      return fetchJson(HallOfReturnsListSchema, `/hall-of-returns/quests?${params.toString()}`);
    },
    getPostMortem: (questId: string) =>
      fetchJson(PostMortemResponseSchema, `/hall-of-returns/quests/${questId}/post-mortem`),
  },
};
