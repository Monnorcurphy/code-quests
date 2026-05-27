import type { AgentEvent, Equipment, MCPServer } from '@code-quests/shared';

export interface AgentSpawnInput {
  questId: string;
  adventurerId: string;
  adventurerName: string;
  adventurerClass?: string;
  modelId: string;
  description: string;
  acceptanceCriteria: string[];
  equipment: Equipment;
  mcpServers?: MCPServer[];
  cwd?: string;
}

export interface AgentHandle {
  pid: number | null;
  events(): AsyncIterable<AgentEvent>;
  cancel(reason?: string): Promise<void>;
  awaitExit(): Promise<{ exitCode: number | null }>;
}

export interface AgentAdapter {
  name: string;
  complete?(input: { system: string; prompt: string; maxTokens?: number }): Promise<string>;
  spawn?(input: AgentSpawnInput): Promise<AgentHandle>;
}
