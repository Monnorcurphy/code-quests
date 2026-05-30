import type { AgentEvent } from '@code-quests/shared';
import type { AgentAdapter, AgentHandle, AgentSpawnInput } from './adapter';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_SITE_URL = 'https://github.com/code-quests';
const DEFAULT_SITE_NAME = 'Code Quests';

export class MissingApiKeyError extends Error {
  constructor() {
    super('OpenRouter adapter requires an API key (input.apiKey).');
    this.name = 'MissingApiKeyError';
  }
}

// Local async queue — same pattern as cc-adapter, inlined here so this
// adapter has no cross-adapter dependency.
class AsyncQueue<T> implements AsyncIterable<T> {
  private buffer: T[] = [];
  private waiting: Array<(result: IteratorResult<T, undefined>) => void> = [];
  private closed = false;

  push(item: T): void {
    if (this.waiting.length > 0) {
      this.waiting.shift()!({ value: item, done: false });
    } else {
      this.buffer.push(item);
    }
  }

  close(): void {
    this.closed = true;
    for (const resolve of this.waiting) {
      resolve({ value: undefined, done: true });
    }
    this.waiting = [];
  }

  [Symbol.asyncIterator](): AsyncIterator<T, undefined> {
    return {
      next: (): Promise<IteratorResult<T, undefined>> => {
        if (this.buffer.length > 0) {
          return Promise.resolve({ value: this.buffer.shift()!, done: false });
        }
        if (this.closed) {
          return Promise.resolve({ value: undefined, done: true });
        }
        return new Promise<IteratorResult<T, undefined>>((resolve) => {
          this.waiting.push(resolve);
        });
      },
    };
  }
}

interface SystemAndUser {
  system: string;
  user: string;
}

function buildSystemAndUser(input: AgentSpawnInput): SystemAndUser {
  const cls = input.adventurerClass ?? 'adventurer';
  const system = `You are ${input.adventurerName}, a Code Quests ${cls}. Stay within the quest scope.`;
  const acList = input.acceptanceCriteria.map((ac) => `- ${ac}`).join('\n');
  const user = `${input.description}\n\nAcceptance criteria:\n${acList}`;
  return { system, user };
}

interface OpenRouterDelta {
  content?: string;
}

interface OpenRouterChoice {
  delta?: OpenRouterDelta;
  finish_reason?: string | null;
}

interface OpenRouterChunk {
  choices?: OpenRouterChoice[];
}

function extractDeltaText(chunk: unknown): string {
  if (typeof chunk !== 'object' || chunk === null) return '';
  const choices = (chunk as OpenRouterChunk).choices;
  if (!Array.isArray(choices) || choices.length === 0) return '';
  const delta = choices[0]?.delta;
  if (!delta || typeof delta.content !== 'string') return '';
  return delta.content;
}

// TODO: tool/function-calling support not wired — v1 is plain text only.
// When adding tools, extend the request body with `tools: [...]` and parse
// `delta.tool_calls` from the SSE stream into combat / paused_input events.

interface SpawnDeps {
  fetch: typeof globalThis.fetch;
}

async function consumeStream(
  body: ReadableStream<Uint8Array>,
  onText: (full: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
  signal: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let accumulated = '';

  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || !line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        if (payload === '[DONE]') {
          onDone();
          return;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(payload);
        } catch {
          // Skip malformed chunks — OpenRouter occasionally sends keep-alives.
          continue;
        }
        const text = extractDeltaText(parsed);
        if (text) {
          accumulated += text;
          onText(accumulated);
        }
      }
    }
    // Stream closed without an explicit [DONE].
    onDone();
  } catch (err) {
    if (signal.aborted) return;
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

async function spawnHandle(
  input: AgentSpawnInput,
  deps: SpawnDeps,
): Promise<AgentHandle> {
  if (!input.apiKey) {
    throw new MissingApiKeyError();
  }
  if (!input.model) {
    throw new Error('OpenRouter adapter requires input.model with a modelId.');
  }

  const queue = new AsyncQueue<AgentEvent>();
  const controller = new AbortController();
  let settled = false;
  let exitResolve!: (v: { exitCode: number | null }) => void;
  const exitPromise = new Promise<{ exitCode: number | null }>((r) => {
    exitResolve = r;
  });

  const finalize = (event: AgentEvent): void => {
    if (settled) return;
    settled = true;
    queue.push(event);
    queue.close();
    exitResolve({ exitCode: event.type === 'completed' ? 0 : 1 });
  };

  const { system, user } = buildSystemAndUser(input);
  const cfg = input.model.config ?? {};
  const temperature = typeof cfg.temperature === 'number' ? cfg.temperature : DEFAULT_TEMPERATURE;
  const maxTokens = typeof cfg.maxTokens === 'number' ? cfg.maxTokens : DEFAULT_MAX_TOKENS;
  const siteUrl = typeof cfg.siteUrl === 'string' ? cfg.siteUrl : DEFAULT_SITE_URL;
  const siteName = typeof cfg.siteName === 'string' ? cfg.siteName : DEFAULT_SITE_NAME;

  const body = JSON.stringify({
    model: input.model.modelId,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    stream: true,
    temperature,
    max_tokens: maxTokens,
  });

  // Fire the request asynchronously — the handle returns immediately so the
  // caller can start iterating the event stream.
  void (async (): Promise<void> => {
    let response: Response;
    try {
      response = await deps.fetch(OPENROUTER_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': siteUrl,
          'X-Title': siteName,
        },
        body,
        signal: controller.signal,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      finalize({ type: 'failed', timestamp: new Date().toISOString(), reason: msg });
      return;
    }

    if (!response.ok) {
      let detail = '';
      try {
        detail = await response.text();
      } catch {
        // ignore body read errors
      }
      const reason = `OpenRouter HTTP ${String(response.status)}${detail ? `: ${detail.slice(0, 512)}` : ''}`;
      finalize({ type: 'failed', timestamp: new Date().toISOString(), reason });
      return;
    }

    if (!response.body) {
      finalize({
        type: 'failed',
        timestamp: new Date().toISOString(),
        reason: 'OpenRouter response had no body',
      });
      return;
    }

    await consumeStream(
      response.body,
      (full) => {
        if (settled) return;
        const truncated = full.length > 8192 ? full.slice(0, 8192) : full;
        queue.push({
          type: 'progress',
          timestamp: new Date().toISOString(),
          message: truncated,
        });
      },
      () => {
        finalize({ type: 'completed', timestamp: new Date().toISOString() });
      },
      (err) => {
        finalize({
          type: 'failed',
          timestamp: new Date().toISOString(),
          reason: err.message,
        });
      },
      controller.signal,
    );
  })();

  return {
    pid: null,
    events(): AsyncIterable<AgentEvent> {
      return queue;
    },
    async cancel(): Promise<void> {
      if (settled) return;
      controller.abort();
      finalize({ type: 'completed', timestamp: new Date().toISOString() });
    },
    async respond(_text: string): Promise<void> {
      const reason = 'OpenRouter adapter does not support mid-quest replies yet';
      process.stderr.write(`[openrouter-adapter] respond() ignored: ${reason}\n`);
      if (settled) return;
      queue.push({
        type: 'failed',
        timestamp: new Date().toISOString(),
        reason,
      });
    },
    async awaitExit(): Promise<{ exitCode: number | null }> {
      return exitPromise;
    },
  };
}

export function createOpenRouterAdapter(): AgentAdapter {
  return {
    name: 'openrouter',
    spawn: (input: AgentSpawnInput): Promise<AgentHandle> =>
      spawnHandle(input, { fetch: globalThis.fetch.bind(globalThis) }),
  };
}
