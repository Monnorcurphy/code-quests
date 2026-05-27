export interface AgentAdapter {
  name: string;
  complete(input: { system: string; prompt: string; maxTokens?: number }): Promise<string>;
}
