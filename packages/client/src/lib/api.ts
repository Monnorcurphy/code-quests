import { z } from 'zod';
import {
  AdventurerSchema,
  QuestSchema,
  EpicSchema,
} from '@code-quests/shared';

const BASE_URL = 'http://localhost:4001';

async function fetchJson<T>(schema: z.ZodType<T>, path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  const data: unknown = await res.json();
  return schema.parse(data);
}

export const api = {
  adventurers: {
    list: () => fetchJson(z.array(AdventurerSchema), '/adventurers'),
  },
  quests: {
    list: () => fetchJson(z.array(QuestSchema), '/quests'),
  },
  epics: {
    list: () => fetchJson(z.array(EpicSchema), '/epics'),
  },
};
