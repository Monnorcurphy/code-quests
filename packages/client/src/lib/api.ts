import { z } from 'zod';
import {
  AdventurerSchema,
  AdventurerClassSchema,
  AdventurerStyleSchema,
  QuestSchema,
  QuestSceneKeySchema,
  QuestStatusSchema,
  FailureSummarySchema,
  EpicSchema,
  SkillSchema,
  ToolSchema,
  MCPServerSchema,
  EquipmentSchema,
  SpecAuditSchema,
  AgentEventSchema,
  MonsterTypeSchema,
  MonsterSchema,
  MonsterEncounterSchema,
  ForgeSkillSchema,
  ConfirmCandidateSchema,
  CreateMonsterTypeSchema,
  ProjectSchema,
  CreateProjectSchema,
  ModelSchema,
  CreateModelSchema,
} from '@code-quests/shared';
import type { Equipment, AgentEvent, AdventurerClass, AdventurerStyle, QuestStatus, FailureSummary, FailureSummaryRecommendation, QuestSceneKey, MonsterType, Monster, MonsterEncounter, MonsterScope, SplitChild, ForgeSkillInput, ConfirmCandidateInput, CreateMonsterTypeInput, CreateProjectInput, CreateModelInput } from '@code-quests/shared';

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

// Special-case POST that does not validate the response (used for endpoints
// whose response shape is loosely structured / model-dependent).
async function postRaw<T>(path: string, body: unknown): Promise<T> {
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
  return (await res.json()) as T;
}

async function deleteRequest(path: string): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE' });
  if (!res.ok) {
    const raw: unknown = await res.json().catch(() => ({ error: `${res.statusText}` }));
    const parsed = ApiErrorBodySchema.safeParse(raw);
    const msg = parsed.success ? parsed.data.error : `${res.status} ${res.statusText}`;
    const field = parsed.success ? parsed.data.field : undefined;
    throw new ApiError(msg, { field, status: res.status, data: raw });
  }
}

async function postEmpty(path: string, body: unknown = {}): Promise<void> {
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
  projectId: z.string().nullable().optional(),
  modelId: z.string().nullable().optional(),
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
  monsterTypeId: z.string(),
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
  equipment: EquipmentSchema.default({ skillIds: [], toolIds: [], mcpServerIds: [] }),
  failureSummary: FailureSummarySchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // Nullish (not just nullable) — the post-mortem endpoint surfaces the
  // adventurer at the top level of the response, so quest.adventurer is
  // undefined there. The list endpoint includes it on each quest row.
  adventurer: z.object({
    id: z.string(),
    name: z.string(),
    class: AdventurerClassSchema,
  }).nullish(),
  fatalMonster: FatalMonsterSchema.nullish(),
}).passthrough();

const HallOfReturnsListSchema = z.object({
  items: z.array(HallOfReturnsQuestSchema),
  nextCursor: z.string().nullable(),
  total: z.number().default(0),
});

const PostMortemAttemptSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
  // Server may omit endedAt on a still-running attempt and may not include
  // events at all (the events_json blob is fetched separately when needed).
  endedAt: z.string().nullish(),
  events: z.array(AgentEventSchema).default([]),
}).passthrough();

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

export type { ForgeSkillInput, ConfirmCandidateInput, CreateMonsterTypeInput };

// Schemas that match the actual server response shapes
const RepostServerResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
}).passthrough();

const SplitServerResponseSchema = z.object({
  childQuests: z.array(z.object({ id: z.string(), title: z.string() }).passthrough()),
}).passthrough();

export type RepostResult = { newQuestId: string; newTitle: string };
export type SplitResult = { questIds: string[]; titles: string[] };

// The /models endpoints return the base Model record plus a server-computed
// `hasKey` boolean (whether an API key is stored in the keychain for it).
// The plaintext key itself is never returned.
const ReturnedModelSchema = ModelSchema.extend({
  hasKey: z.boolean(),
});
export type ReturnedModel = z.infer<typeof ReturnedModelSchema>;

export const api = {
  adventurers: {
    list: () => fetchJson(z.array(AdventurerSchema), '/adventurers'),
    get: (id: string) => fetchJson(AdventurerSchema, `/adventurers/${id}`),
    create: (input: CreateAdventurerInput) =>
      postJson(AdventurerSchema, '/adventurers', input),
    updateStyle: (id: string, style: AdventurerStyle) =>
      patchJson(AdventurerSchema, `/adventurers/${id}/style`, {
        style: AdventurerStyleSchema.parse(style),
      }),
    delete: (id: string) => deleteRequest(`/adventurers/${id}`),
  },
  projects: {
    list: () => fetchJson(z.array(ProjectSchema), '/projects'),
    create: (input: CreateProjectInput) =>
      postJson(ProjectSchema, '/projects', CreateProjectSchema.parse(input)),
    delete: (id: string) => deleteRequest(`/projects/${id}`),
  },
  models: {
    list: (): Promise<ReturnedModel[]> =>
      fetchJson(z.array(ReturnedModelSchema), '/models'),
    create: (input: CreateModelInput): Promise<ReturnedModel> =>
      postJson(ReturnedModelSchema, '/models', CreateModelSchema.parse(input)),
    delete: (id: string) => deleteRequest(`/models/${id}`),
    probe: async (
      provider: 'claude_cli' | 'ollama' | 'openrouter',
      baseUrl?: string,
    ): Promise<{
      provider: 'claude_cli';
      installed: boolean;
      binPath?: string;
      version?: string;
      suggestedIds: string[];
      hint: string;
    } | {
      provider: 'ollama';
      reachable: boolean;
      baseUrl: string;
      installedModels: Array<{ name: string; size?: string }>;
      hint: string;
    } | {
      provider: 'openrouter';
      hint: string;
      catalogueUrl: string;
      popularIds: string[];
    }> => {
      const qs = new URLSearchParams({ provider });
      if (baseUrl) qs.set('baseUrl', baseUrl);
      const res = await fetch(`${BASE_URL}/models/probe?${qs.toString()}`);
      if (!res.ok) {
        const raw: unknown = await res.json().catch(() => ({ error: `${res.statusText}` }));
        const parsed = ApiErrorBodySchema.safeParse(raw);
        throw new ApiError(parsed.success ? parsed.data.error : `${res.status}`, {
          status: res.status, data: raw,
        });
      }
      return res.json();
    },
  },
  fs: {
    // Pops the native folder picker on macOS. Returns the absolute path,
    // or null when the user cancels the dialog.
    pickFolder: async (startPath?: string): Promise<string | null> => {
      const res = await fetch(`${BASE_URL}/fs/pick-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(startPath ? { startPath } : {}),
      });
      if (res.status === 204) return null; // user cancelled
      if (!res.ok) {
        const raw: unknown = await res.json().catch(() => ({ error: `${res.statusText}` }));
        const parsed = ApiErrorBodySchema.safeParse(raw);
        const msg = parsed.success ? parsed.data.error : `${res.status} ${res.statusText}`;
        throw new ApiError(msg, { status: res.status, data: raw });
      }
      const data = (await res.json()) as { path: string };
      return data.path;
    },
  },
  council: {
    consult: (body: {
      modelId: string;
      draftQuest: {
        title?: string;
        description?: string;
        acceptanceCriteria?: string[];
      };
      history: Array<{ role: 'user' | 'assistant'; content: string }>;
      userMessage: string;
    }): Promise<{
      reply: string;
      modelName: string;
      provider: string;
      tokenUsage?: { input?: number; output?: number };
    }> => postRaw('/council/consult', body),
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
    dispatch: (id: string, bypass = false, adventurerId?: string | null) =>
      postJson(
        QuestSchema,
        `/quests/${id}/dispatch${bypass ? '?bypass=true' : ''}`,
        adventurerId ? { adventurerId } : {},
      ),
    autoMatch: (id: string) =>
      fetchJson(
        z.object({
          adventurerId: z.string().nullable(),
          adventurerName: z.string().nullable(),
          adventurerClass: AdventurerClassSchema.nullable(),
          reason: z.string(),
        }),
        `/quests/${id}/auto-match`,
      ),
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
    repost: (id: string, adjustments?: { acceptanceCriteria?: string[]; edgeCases?: string[]; equipment?: Equipment }): Promise<RepostResult> =>
      postJson(RepostServerResponseSchema, `/quests/${id}/actions/repost`, { adjustments })
        .then((q) => ({ newQuestId: q.id, newTitle: q.title })),
    retire: (id: string) =>
      postJson(z.object({}).passthrough(), `/quests/${id}/actions/retire`, {}),
    split: (id: string, children: SplitChild[]): Promise<SplitResult> =>
      postJson(SplitServerResponseSchema, `/quests/${id}/actions/split`, { children })
        .then(({ childQuests }) => ({
          questIds: childQuests.map((q) => q.id),
          titles: childQuests.map((q) => q.title),
        })),
  },
  epics: {
    list: () => fetchJson(z.array(EpicSchema), '/epics'),
    create: (body: { title: string; goal: string }) =>
      postJson(EpicSchema, '/epics', body),
  },
  skills: {
    list: (opts?: { status?: 'active' | 'candidate' | 'retired' }) => {
      const qs = opts?.status !== undefined ? `?status=${opts.status}` : '';
      return fetchJson(z.array(SkillSchema), `/skills${qs}`);
    },
    get: (id: string) => fetchJson(SkillSchema, `/skills/${id}`),
    forge: (input: ForgeSkillInput) => postJson(SkillSchema, '/skills', ForgeSkillSchema.parse(input)),
    confirmCandidate: (id: string, input?: ConfirmCandidateInput) =>
      postJson(SkillSchema, `/skills/${id}/confirm`, input !== undefined ? ConfirmCandidateSchema.parse(input) : {}),
    dismissCandidate: (id: string) => postEmpty(`/skills/${id}/dismiss`),
    retire: (id: string) => postJson(SkillSchema, `/skills/${id}/retire`, {}),
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
    createType: (input: CreateMonsterTypeInput): Promise<MonsterType> =>
      postJson(MonsterTypeSchema, '/monsters/types', CreateMonsterTypeSchema.parse(input)),
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
  showcase: {
    reset: () =>
      postJson(z.object({ epicId: z.string() }), '/showcase/reset', {}),
  },
};
