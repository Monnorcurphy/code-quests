import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AgentEvent, Model } from '@code-quests/shared';
import { createOpenRouterAdapter } from '../openrouter-adapter';

const MODEL: Model = {
  id: 'm1',
  name: 'Test Sonnet',
  provider: 'openrouter',
  modelId: 'anthropic/claude-3.5-sonnet',
  config: { siteName: 'Code Quests Test', siteUrl: 'https://example.test' },
  createdAt: '2026-01-01T00:00:00.000Z',
  lastUsedAt: null,
};

const SPAWN_INPUT_BASE = {
  questId: 'quest-1',
  adventurerId: 'adv-1',
  adventurerName: 'Aria',
  adventurerClass: 'champion',
  modelId: 'anthropic/claude-3.5-sonnet',
  model: MODEL,
  apiKey: 'sk-or-test-key',
  description: 'Defeat the goblin and return victorious.',
  acceptanceCriteria: ['Goblin defeated', 'Return to town'],
  equipment: { skillIds: [], toolIds: [], mcpServerIds: [] },
};

function sseChunk(text: string): string {
  return `data: ${JSON.stringify({
    choices: [{ delta: { content: text } }],
  })}\n\n`;
}

function makeReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]));
        i += 1;
      } else {
        controller.close();
      }
    },
  });
}

async function drain(handle: { events: () => AsyncIterable<AgentEvent> }): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const ev of handle.events()) {
    events.push(ev);
  }
  return events;
}

describe('openrouter-adapter', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('streams three text chunks as accumulating progress events then completes', async () => {
    const stream = makeReadableStream([
      sseChunk('Hello'),
      sseChunk(' world'),
      sseChunk('!'),
      'data: [DONE]\n\n',
    ]);
    fetchSpy.mockResolvedValueOnce(
      new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    );

    const adapter = createOpenRouterAdapter();
    const handle = await adapter.spawn!(SPAWN_INPUT_BASE);
    expect(handle.pid).toBeNull();

    const events = await drain(handle);
    const progress = events.filter((e) => e.type === 'progress');
    expect(progress).toHaveLength(3);
    expect(progress[0]).toMatchObject({ type: 'progress', message: 'Hello' });
    expect(progress[1]).toMatchObject({ type: 'progress', message: 'Hello world' });
    expect(progress[2]).toMatchObject({ type: 'progress', message: 'Hello world!' });
    expect(events.at(-1)).toMatchObject({ type: 'completed' });

    const { exitCode } = await handle.awaitExit();
    expect(exitCode).toBe(0);

    // Verify the call was wired with the correct headers and body shape.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk-or-test-key');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['HTTP-Referer']).toBe('https://example.test');
    expect(headers['X-Title']).toBe('Code Quests Test');
    const parsedBody = JSON.parse(init.body as string) as {
      model: string;
      stream: boolean;
      messages: Array<{ role: string }>;
    };
    expect(parsedBody.model).toBe('anthropic/claude-3.5-sonnet');
    expect(parsedBody.stream).toBe(true);
    expect(parsedBody.messages).toHaveLength(2);
    expect(parsedBody.messages[0].role).toBe('system');
    expect(parsedBody.messages[1].role).toBe('user');
  });

  it('emits a failed event when the HTTP response is non-200', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('{"error":"invalid api key"}', {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const adapter = createOpenRouterAdapter();
    const handle = await adapter.spawn!(SPAWN_INPUT_BASE);
    const events = await drain(handle);

    const last = events.at(-1);
    expect(last?.type).toBe('failed');
    if (last?.type === 'failed') {
      expect(last.reason).toContain('401');
    }

    const { exitCode } = await handle.awaitExit();
    expect(exitCode).toBe(1);
  });

  it('emits a failed event when fetch rejects with a network error', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const adapter = createOpenRouterAdapter();
    const handle = await adapter.spawn!(SPAWN_INPUT_BASE);
    const events = await drain(handle);

    const last = events.at(-1);
    expect(last?.type).toBe('failed');
    if (last?.type === 'failed') {
      expect(last.reason).toContain('ECONNREFUSED');
    }

    const { exitCode } = await handle.awaitExit();
    expect(exitCode).toBe(1);
  });

  it('throws when spawn is called without an API key', async () => {
    const adapter = createOpenRouterAdapter();
    const inputNoKey = { ...SPAWN_INPUT_BASE };
    delete (inputNoKey as { apiKey?: string }).apiKey;

    await expect(adapter.spawn!(inputNoKey)).rejects.toThrow(/api key/i);
    // fetch should never be called when we bail on the precondition
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
