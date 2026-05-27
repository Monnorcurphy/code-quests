import Anthropic from '@anthropic-ai/sdk';
import type { AgentAdapter } from './adapter';

export class MissingApiKeyError extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY is not set — cannot use Haiku adapter');
    this.name = 'MissingApiKeyError';
  }
}

export function createHaikuAdapter(): AgentAdapter {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new MissingApiKeyError();
  }
  const client = new Anthropic({ apiKey });
  return {
    name: 'haiku',
    async complete(input: { system: string; prompt: string; maxTokens?: number }): Promise<string> {
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: input.maxTokens ?? 1024,
        system: input.system,
        messages: [{ role: 'user', content: input.prompt }],
      });
      const block = message.content[0];
      if (block.type !== 'text') {
        throw new Error('Unexpected non-text response from Haiku adapter');
      }
      return block.text;
    },
  };
}
