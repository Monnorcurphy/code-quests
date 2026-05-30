import { z } from 'zod';

export const ModelProviderSchema = z.enum([
  'claude_cli',
  'openrouter',
  'ollama',
  'anthropic_api',
  'openai',
]);
export type ModelProvider = z.infer<typeof ModelProviderSchema>;

export const ModelConfigSchema = z.object({
  // Ollama base URL (defaults to http://localhost:11434)
  baseUrl: z.string().url().optional(),
  // OpenRouter / OpenAI extras
  siteName: z.string().optional(),
  siteUrl: z.string().optional(),
  // Default sampling parameters for this model. Optional; adapter applies
  // its own defaults when missing.
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
}).passthrough();
export type ModelConfig = z.infer<typeof ModelConfigSchema>;

export const ModelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  provider: ModelProviderSchema,
  // Provider-specific model identifier (e.g. "anthropic/claude-3.5-sonnet"
  // for OpenRouter, "llama3.1:70b" for Ollama, "claude-sonnet-4-6" for
  // claude CLI session-resume).
  modelId: z.string().min(1),
  config: ModelConfigSchema.default({}),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});
export type Model = z.infer<typeof ModelSchema>;

export const CreateModelSchema = z.object({
  name: z.string().trim().min(1).max(80),
  provider: ModelProviderSchema,
  modelId: z.string().trim().min(1).max(200),
  // Optional plaintext at create time only. The server hands this to the
  // keychain and never stores it in the DB or returns it on read. Required
  // for providers that need a key (openrouter, openai, anthropic_api);
  // ignored for claude_cli (subscription auth) and ollama (no auth).
  apiKey: z.string().min(1).max(500).optional(),
  config: ModelConfigSchema.default({}),
});
export type CreateModelInput = z.infer<typeof CreateModelSchema>;

// Providers that require an API key. Used by the create endpoint to
// validate, and by the dispatch path to read from keychain.
export const PROVIDERS_REQUIRING_KEY: ModelProvider[] = [
  'openrouter',
  'openai',
  'anthropic_api',
];

export function providerNeedsKey(p: ModelProvider): boolean {
  return PROVIDERS_REQUIRING_KEY.includes(p);
}
