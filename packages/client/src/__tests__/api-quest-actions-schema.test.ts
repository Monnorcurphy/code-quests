import { describe, it, expect, vi, afterEach } from 'vitest';
import { api } from '../lib/api';

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(body: unknown, status = 200) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok: status < 400,
    status,
    statusText: 'OK',
    json: async () => body,
  } as Response);
}

const repostServerResponse = {
  id: 'new-quest-id',
  epicId: null,
  title: 'Slay the Dragon (revised)',
  description: 'Original description',
  acceptanceCriteria: ['AC 1'],
  edgeCases: ['edge 1'],
  context: '',
  status: 'idle',
  adventurerId: null,
  agentId: null,
  equipment: { skillIds: [], toolIds: [], mcpServerIds: [] },
  specAudit: null,
  failureSummary: null,
  userFeedback: [],
  currentScene: 'town',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  acLockedAt: null,
};

const splitServerResponse = {
  originalQuest: {
    ...repostServerResponse,
    id: 'q-src',
    title: 'Original Quest',
    status: 'returned_to_town',
    failureSummary: { recommendation: 'break_into_smaller', reason: '', splitIntoQuestIds: ['c1', 'c2'] },
  },
  childQuests: [
    { ...repostServerResponse, id: 'c1', title: 'Child A' },
    { ...repostServerResponse, id: 'c2', title: 'Child B' },
  ],
};

describe('api.quests.repost — schema boundary contract', () => {
  it('maps server response { id, title } to RepostResult { newQuestId, newTitle }', async () => {
    mockFetch(repostServerResponse, 201);
    const result = await api.quests.repost('q-src');
    expect(result).toEqual({ newQuestId: 'new-quest-id', newTitle: 'Slay the Dragon (revised)' });
  });

  it('rejects when server response lacks id field', async () => {
    const bad = { ...repostServerResponse, id: undefined };
    mockFetch(bad, 201);
    await expect(api.quests.repost('q-src')).rejects.toThrow();
  });
});

describe('api.quests.split — schema boundary contract', () => {
  it('maps server { childQuests } to SplitResult { questIds, titles }', async () => {
    mockFetch(splitServerResponse, 201);
    const result = await api.quests.split('q-src', []);
    expect(result).toEqual({ questIds: ['c1', 'c2'], titles: ['Child A', 'Child B'] });
  });

  it('rejects when server response lacks childQuests field', async () => {
    const bad = { originalQuest: splitServerResponse.originalQuest };
    mockFetch(bad, 201);
    await expect(api.quests.split('q-src', [])).rejects.toThrow();
  });
});
