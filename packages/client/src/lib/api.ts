import { z } from 'zod';
import {
  AdventurerSchema,
  AdventurerClassSchema,
  QuestSchema,
  EpicSchema,
} from '@code-quests/shared';

const BASE_URL = 'http://localhost:4001';

const ApiErrorBodySchema = z.object({
  error: z.string(),
  field: z.string().optional(),
});

export class ApiError extends Error {
  field?: string;
  status: number;

  constructor(message: string, opts: { field?: string; status: number }) {
    super(message);
    this.name = 'ApiError';
    this.field = opts.field;
    this.status = opts.status;
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

export const api = {
  adventurers: {
    list: () => fetchJson(z.array(AdventurerSchema), '/adventurers'),
    create: (input: CreateAdventurerInput) =>
      postJson(AdventurerSchema, '/adventurers', input),
  },
  quests: {
    list: () => fetchJson(z.array(QuestSchema), '/quests'),
  },
  epics: {
    list: () => fetchJson(z.array(EpicSchema), '/epics'),
  },
};
