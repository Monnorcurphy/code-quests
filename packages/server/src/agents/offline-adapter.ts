import type { AgentAdapter } from './adapter';

export const offlineAdapter: AgentAdapter = {
  name: 'offline',
  async complete(_input: { system: string; prompt: string; maxTokens?: number }): Promise<string> {
    return JSON.stringify({ gaps: [] });
  },
};
