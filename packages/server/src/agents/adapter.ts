import type { AgentEvent, Equipment, MCPServer, Model } from '@code-quests/shared';

export interface AgentSpawnInput {
  questId: string;
  adventurerId: string;
  adventurerName: string;
  adventurerClass?: string;
  // Loose label used in prompts (model name, "default", etc.). The
  // canonical model record lives in `model` below — adapters that need
  // the real provider/model_id read it from there.
  modelId: string;
  // The full model record. Optional for backward compatibility with the
  // older stub/offline adapters that don't care which model is in use.
  model?: Model;
  // API key for providers that need one. The server reads this from the
  // keychain in the dispatch path and hands it to the adapter so the
  // adapter never has to touch the secret store directly.
  apiKey?: string;
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
  respond(text: string): Promise<void>;
  awaitExit(): Promise<{ exitCode: number | null }>;
}

export interface AgentAdapter {
  name: string;
  complete?(input: { system: string; prompt: string; maxTokens?: number }): Promise<string>;
  spawn?(input: AgentSpawnInput): Promise<AgentHandle>;
}
