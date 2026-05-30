import type { AgentEvent } from '@code-quests/shared';
import type { AgentAdapter, AgentHandle, AgentSpawnInput } from './adapter';

const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_TEMPERATURE = 0.7;

// Small inline async queue — same shape as the one in cc-adapter. Keeping it
// inline avoids creating a shared utility for the single other consumer.
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

interface OllamaMessage {
  role: string;
  content: string;
}

interface OllamaChunk {
  message?: OllamaMessage;
  done?: boolean;
  error?: string;
}

function buildMessages(input: AgentSpawnInput): { system: string; user: string } {
  const cls = input.adventurerClass ?? 'adventurer';
  const system = `You are ${input.adventurerName}, a Code Quests ${cls}. Stay within the quest scope.`;
  const acList = input.acceptanceCriteria.map((ac) => `- ${ac}`).join('\n');
  const user = `${input.description}\n\nAcceptance criteria:\n${acList}`;
  return { system, user };
}

function parseChunk(line: string): OllamaChunk | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as OllamaChunk;
  } catch {
    return null;
  }
}

function isConnectionRefused(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as Record<string, unknown>;
  if (e['code'] === 'ECONNREFUSED') return true;
  const cause = e['cause'];
  if (typeof cause === 'object' && cause !== null) {
    if ((cause as Record<string, unknown>)['code'] === 'ECONNREFUSED') return true;
  }
  const msg = typeof e['message'] === 'string' ? (e['message'] as string) : '';
  return /ECONNREFUSED/i.test(msg);
}

async function spawnHandle(input: AgentSpawnInput): Promise<AgentHandle> {
  const queue = new AsyncQueue<AgentEvent>();
  const baseUrl = input.model?.config.baseUrl ?? DEFAULT_BASE_URL;
  const modelId = input.model?.modelId ?? input.modelId;
  const temperature = input.model?.config.temperature ?? DEFAULT_TEMPERATURE;
  const maxTokens = input.model?.config.maxTokens;
  const controller = new AbortController();

  let settled = false;
  let exitResolve!: (v: { exitCode: number | null }) => void;
  const exitPromise = new Promise<{ exitCode: number | null }>((r) => {
    exitResolve = r;
  });

  const finalize = (code: number | null): void => {
    if (settled) return;
    settled = true;
    queue.close();
    exitResolve({ exitCode: code });
  };

  const pushFailed = (reason: string): void => {
    if (settled) return;
    queue.push({ type: 'failed', timestamp: new Date().toISOString(), reason });
  };

  const pushCompleted = (): void => {
    if (settled) return;
    queue.push({ type: 'completed', timestamp: new Date().toISOString() });
  };

  const { system, user } = buildMessages(input);

  const options: Record<string, number> = { temperature };
  if (typeof maxTokens === 'number') {
    options['num_predict'] = maxTokens;
  }

  const body = JSON.stringify({
    model: modelId,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    stream: true,
    options,
  });

  // Kick off the streaming request without blocking the spawn() resolution.
  void (async () => {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        pushCompleted();
        finalize(0);
        return;
      }
      if (isConnectionRefused(err)) {
        pushFailed(
          `Could not reach Ollama at ${baseUrl}. Install from https://ollama.com or set baseUrl in the model config.`,
        );
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        pushFailed(`Ollama request failed: ${msg}`);
      }
      finalize(1);
      return;
    }

    if (!response.ok) {
      let detail = '';
      try {
        detail = await response.text();
      } catch {
        // best-effort
      }
      const truncated = detail.length > 512 ? detail.slice(0, 512) : detail;
      pushFailed(`Ollama HTTP ${response.status}: ${truncated || response.statusText}`);
      finalize(1);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      pushFailed('Ollama response has no body to stream');
      finalize(1);
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let accumulated = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const chunk = parseChunk(line);
          if (!chunk) continue;
          if (chunk.error) {
            pushFailed(`Ollama error: ${chunk.error}`);
            finalize(1);
            return;
          }
          const piece = chunk.message?.content ?? '';
          if (piece) {
            accumulated += piece;
            const message = accumulated.length > 4096 ? accumulated.slice(-4096) : accumulated;
            queue.push({
              type: 'progress',
              timestamp: new Date().toISOString(),
              message,
            });
          }
          if (chunk.done === true) {
            pushCompleted();
            finalize(0);
            return;
          }
        }
      }
      // Drain any trailing buffered line.
      if (buffer.trim()) {
        const chunk = parseChunk(buffer);
        if (chunk?.done === true) {
          pushCompleted();
          finalize(0);
          return;
        }
      }
      // Stream ended without a done flag — treat as completion.
      pushCompleted();
      finalize(0);
    } catch (err) {
      if (controller.signal.aborted) {
        pushCompleted();
        finalize(0);
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      pushFailed(`Ollama stream read failed: ${msg}`);
      finalize(1);
    }
  })();

  return {
    pid: null,
    events(): AsyncIterable<AgentEvent> {
      return queue;
    },
    async cancel(): Promise<void> {
      if (settled) return;
      try {
        controller.abort();
      } catch {
        // best-effort
      }
    },
    async respond(_text: string): Promise<void> {
      process.stderr.write(
        '[ollama-adapter] respond() called — mid-quest replies are not supported\n',
      );
      if (settled) return;
      queue.push({
        type: 'failed',
        timestamp: new Date().toISOString(),
        reason: 'Ollama adapter does not support mid-quest replies yet',
      });
    },
    async awaitExit(): Promise<{ exitCode: number | null }> {
      return exitPromise;
    },
  };
}

export function createOllamaAdapter(): AgentAdapter {
  return {
    name: 'ollama',
    spawn: spawnHandle,
  };
}
