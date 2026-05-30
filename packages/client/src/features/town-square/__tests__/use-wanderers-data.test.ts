import { describe, it, expect } from 'vitest';
import type { Adventurer, Quest } from '@code-quests/shared';
import { buildIdleList } from '../use-wanderers-data';

function adv(id: string, name: string): Adventurer {
  return {
    id,
    name,
    class: 'champion',
    modelId: 'claude-sonnet',
    createdAt: new Date().toISOString(),
    stats: {},
    specializations: [],
    scars: [],
  };
}

function quest(adventurerId: string | null, status: Quest['status']): Quest {
  return {
    id: `q-${adventurerId ?? 'none'}-${status}`,
    title: 't',
    description: '',
    acceptanceCriteria: [],
    edgeCases: [],
    context: '',
    status,
    adventurerId,
    agentId: null,
    epicId: null,
    projectId: null,
    modelId: null,
    equipment: { skillIds: [], toolIds: [], mcpServerIds: [] },
    specAudit: null,
    failureSummary: null,
    currentScene: 'quest-forest',
    inputRequest: null,
    userBlocker: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as unknown as Quest;
}

describe('buildIdleList', () => {
  it('returns all adventurers when no quests exist', () => {
    const advs = [adv('a1', 'Aria'), adv('a2', 'Borin')];
    expect(buildIdleList(advs, [])).toEqual([
      { id: 'a1', name: 'Aria' },
      { id: 'a2', name: 'Borin' },
    ]);
  });

  it('excludes adventurers on active quests', () => {
    const advs = [adv('a1', 'Aria'), adv('a2', 'Borin')];
    const result = buildIdleList(advs, [quest('a1', 'active')]);
    expect(result.map((a) => a.id)).toEqual(['a2']);
  });

  it('excludes adventurers on paused_input quests', () => {
    const advs = [adv('a1', 'Aria'), adv('a2', 'Borin')];
    const result = buildIdleList(advs, [quest('a1', 'paused_input')]);
    expect(result.map((a) => a.id)).toEqual(['a2']);
  });

  it('excludes adventurers on user_blocked quests', () => {
    const advs = [adv('a1', 'Aria')];
    expect(buildIdleList(advs, [quest('a1', 'user_blocked')])).toEqual([]);
  });

  it('keeps adventurers whose quests are idle/complete/failed', () => {
    const advs = [adv('a1', 'Aria'), adv('a2', 'Borin')];
    const quests = [quest('a1', 'complete'), quest('a2', 'failed')];
    expect(buildIdleList(advs, quests).map((a) => a.id)).toEqual(['a1', 'a2']);
  });

  it('ignores quests with no adventurerId', () => {
    const advs = [adv('a1', 'Aria')];
    expect(buildIdleList(advs, [quest(null, 'active')]).map((a) => a.id)).toEqual(['a1']);
  });
});
