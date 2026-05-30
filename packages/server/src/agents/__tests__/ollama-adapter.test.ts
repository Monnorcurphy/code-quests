import { describe, it, expect, vi, afterEach } from 'vitest';
import { createOllamaAdapter } from '../ollama-adapter';
import type { AgentEvent, Model } from '@code-quests/shared';
import type { AgentSpawnInput } from '../adapter';

const MODEL: Model = {
  id: 'm1',
  name: 'Local Llama',
  provider: 'ollama',
  modelId: 'llama3.1:70b',
  config: { baseUrl: 'http://localhost:11434', temperature: 0.5 },
  createdAt: new Date().toISOString(),
  lastUsedAt: null,
};

const SPAWN_INPUT: AgentSpawnInput = {
  questId: 'quest-1',
  adventurerId: 'adv-1',
  adventurerName: 'Aria',
  adventurerClass: 'champion',
  modelId: 'llama3.1:70b',
  model: MODEL,
  description: 'Defeat the dragon.',
  acceptanceCriteria: ['Dragon defeated', 'Return to town'],
  equipment: { skillIds: [], toolIds: [], mcpServerIds: [] },
};

/** Build a ReadableStream<Uint8Array> from an array of strings. */
function streamFromLines(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= lines.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(lines[i]));
      i += 1;
    },
  });
}

function ndjsonResponse(chunks: Array<Record<string, unknown>>): Response {
  const lines = chunks.map((c) => JSON.stringify(c) + '\n');
  return new Response(streamFromLines(lines), {
    status: 200,
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}

async function drain(handle: { events: () => AsyncIterable<AgentEvent> }): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const ev of handle.events()) {
    events.push(ev);
  }
  return events;
}

describe('ollama-adapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('streams ndjson chunks as progress events with accumulated text, then completed', async () => {
    const chunks = [
      { message: { role: 'assistant', content: 'Hello' }, done: false },
      { message: { role: 'assistant', content: ' there' }, done: false },
      { message: { role: 'assistant', content: ' adventurer!' }, done: false },
      { message: { role: 'assistant', content: '' }, done: true },
    ];

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(ndjsonResponse(chunks));

    const adapter = createOllamaAdapter();
    const handle = await adapter.spawn!(SPAWN_INPUT);

    const events = await drain(handle);
    const { exitCode } = await handle.awaitExit();
    expect(exitCode).toBe(0);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('http://localhost:11434/api/chat');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe('llama3.1:70b');
    expect(body.stream).toBe(true);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].role).toBe('user');
    expect(body.options.temperature).toBe(0.5);

    const progressEvents = events.filter((e) => e.type === 'progress');
    expect(progressEvents).toHaveLength(3);
    expect(progressEvents[0]).toMatchObject({ type: 'progress', message: 'Hello' });
    expect(progressEvents[1]).toMatchObject({ type: 'progress', message: 'Hello there' });
    expect(progressEvents[2]).toMatchObject({
      type: 'progress',
      message: 'Hello there adventurer!',
    });

    expect(events.at(-1)).toMatchObject({ type: 'completed' });
  });

  it('emits failed with helpful install message when ollama is not running (ECONNREFUSED)', async () => {
    const err = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:11434'), {
      code: 'ECONNREFUSED',
    });
    vi.spyOn(global, 'fetch').mockRejectedValue(err);

    const adapter = createOllamaAdapter();
    const handle = await adapter.spawn!(SPAWN_INPUT);

    const events = await drain(handle);
    const { exitCode } = await handle.awaitExit();
    expect(exitCode).toBe(1);

    const failed = events.find((e) => e.type === 'failed');
    expect(failed).toBeDefined();
    if (failed?.type === 'failed') {
      expect(failed.reason).toContain('Could not reach Ollama');
      expect(failed.reason).toContain('http://localhost:11434');
      expect(failed.reason).toContain('https://ollama.com');
    }
  });

  it('emits failed when ollama returns HTTP 400', async () => {
    const errResponse = new Response('model not found', {
      status: 400,
      statusText: 'Bad Request',
    });
    vi.spyOn(global, 'fetch').mockResolvedValue(errResponse);

    const adapter = createOllamaAdapter();
    const handle = await adapter.spawn!(SPAWN_INPUT);

    const events = await drain(handle);
    const { exitCode } = await handle.awaitExit();
    expect(exitCode).toBe(1);

    const failed = events.find((e) => e.type === 'failed');
    expect(failed).toBeDefined();
    if (failed?.type === 'failed') {
      expect(failed.reason).toMatch(/Ollama HTTP 400/);
      expect(failed.reason).toContain('model not found');
    }
  });

  it('cancel() aborts the in-flight fetch and closes the queue', async () => {
    // Build a stream we can error from the outside when the abort signal fires.
    // The adapter's read() loop will reject with our abort error, and because
    // controller.signal.aborted is true at that point, the catch path treats
    // it as a clean cancel and pushes completed.
    let streamCtrl: ReadableStreamDefaultController<Uint8Array> | null = null;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamCtrl = controller;
      },
    });
    const response = new Response(stream, { status: 200 });

    vi.spyOn(global, 'fetch').mockImplementation(async (_input, init) => {
      const signal = (init as RequestInit | undefined)?.signal;
      if (signal) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        signal.addEventListener('abort', () => {
          try {
            streamCtrl?.error(new DOMException('Aborted', 'AbortError'));
          } catch {
            // best-effort
          }
        });
      }
      return response;
    });

    const adapter = createOllamaAdapter();
    const handle = await adapter.spawn!(SPAWN_INPUT);

    const eventsP = drain(handle);

    // Give the fetch+read loop a tick to start before cancelling.
    await new Promise<void>((r) => setImmediate(r));
    await handle.cancel();

    const events = await eventsP;
    const { exitCode } = await handle.awaitExit();
    expect(exitCode).toBe(0);
    expect(events.at(-1)).toMatchObject({ type: 'completed' });
  });
});
