import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AgentEvent } from '@code-quests/shared';
import { subscribe, connectQuestSocket } from '../quest-socket';
import type { ConnectionStatus } from '../quest-socket';

// ---------------------------------------------------------------------------
// Fake WebSocket
// ---------------------------------------------------------------------------

type ListenerFn = (e: unknown) => void;

class FakeWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;

  readyState = 0;
  readonly url: string;
  readonly send = vi.fn<(data: string) => void>();
  readonly close: () => void;

  private _listeners = new Map<string, ListenerFn[]>();

  constructor(url: string) {
    this.url = url;
    wsInstances.push(this);
    this.close = vi.fn(() => {
      this.readyState = FakeWebSocket.CLOSED;
      this._emit('close', {});
    });
  }

  addEventListener(type: string, fn: ListenerFn): void {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type)!.push(fn);
  }

  /** Simulate a successful connection from the server. */
  _open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this._emit('open', {});
  }

  /** Simulate the server sending a JSON-serialisable message. */
  _message(data: unknown): void {
    this._emit('message', { data: JSON.stringify(data) });
  }

  /** Simulate the server sending a raw (possibly non-JSON) string. */
  _rawMessage(data: string): void {
    this._emit('message', { data });
  }

  /** Simulate the server dropping the connection without the client closing. */
  _drop(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this._emit('close', {});
  }

  _emit(type: string, evt: unknown): void {
    for (const fn of this._listeners.get(type) ?? []) fn(evt);
  }
}

let wsInstances: FakeWebSocket[] = [];

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  wsInstances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  wsInstances = [];
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('subscribe', () => {
  it('creates a WebSocket and sends subscribe on open', () => {
    const onEvent = vi.fn<(e: AgentEvent) => void>();
    subscribe('q1', onEvent);

    expect(wsInstances).toHaveLength(1);

    wsInstances[0]._open();

    expect(wsInstances[0].send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'subscribe', questId: 'q1' }),
    );
  });

  it('forwards valid AgentEvents to the callback', () => {
    const onEvent = vi.fn<(e: AgentEvent) => void>();
    subscribe('q1', onEvent);
    wsInstances[0]._open();

    const event: AgentEvent = {
      type: 'progress',
      timestamp: '2024-01-01T00:00:00.000Z',
      message: 'working',
    };
    wsInstances[0]._message(event);

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(event);
  });

  it('drops non-JSON frames without calling onEvent', () => {
    const onEvent = vi.fn<(e: AgentEvent) => void>();
    subscribe('q1', onEvent);
    wsInstances[0]._open();

    wsInstances[0]._rawMessage('not { valid ] json');

    expect(onEvent).not.toHaveBeenCalled();
  });

  it('drops frames that fail AgentEventSchema validation', () => {
    const onEvent = vi.fn<(e: AgentEvent) => void>();
    subscribe('q1', onEvent);
    wsInstances[0]._open();

    wsInstances[0]._message({ type: 'unknown_event_type', foo: 'bar' });

    expect(onEvent).not.toHaveBeenCalled();
  });

  it('sends unsubscribe and closes when unsubscribe fn is called', () => {
    const onEvent = vi.fn<(e: AgentEvent) => void>();
    const unsub = subscribe('q1', onEvent);
    wsInstances[0]._open();

    unsub();

    expect(wsInstances[0].send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'unsubscribe', questId: 'q1' }),
    );
    expect(wsInstances[0].close).toHaveBeenCalledTimes(1);
  });

  it('does not reconnect after unsubscribe', () => {
    const onEvent = vi.fn<(e: AgentEvent) => void>();
    const unsub = subscribe('q1', onEvent);
    wsInstances[0]._open();

    unsub();

    vi.advanceTimersByTime(15_000);
    expect(wsInstances).toHaveLength(1);
  });

  it('reconnects with backoff after server drops connection', () => {
    const onEvent = vi.fn<(e: AgentEvent) => void>();
    subscribe('q1', onEvent);
    wsInstances[0]._open();

    // Server drops the connection
    wsInstances[0]._drop();

    expect(wsInstances).toHaveLength(1); // not yet reconnected

    // Advance past backoff base (500 ms)
    vi.advanceTimersByTime(500);

    expect(wsInstances).toHaveLength(2);
  });

  it('re-subscribes to the quest after reconnect', () => {
    const onEvent = vi.fn<(e: AgentEvent) => void>();
    subscribe('q1', onEvent);
    wsInstances[0]._open();

    wsInstances[0]._drop();
    vi.advanceTimersByTime(500);

    wsInstances[1]._open();

    expect(wsInstances[1].send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'subscribe', questId: 'q1' }),
    );
  });

  it('uses exponential backoff on repeated disconnects', () => {
    const onEvent = vi.fn<(e: AgentEvent) => void>();
    subscribe('q1', onEvent);
    wsInstances[0]._open();

    // First drop → 500 ms backoff
    wsInstances[0]._drop();
    vi.advanceTimersByTime(499);
    expect(wsInstances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(wsInstances).toHaveLength(2);

    // Second drop → 1000 ms backoff
    wsInstances[1]._drop();
    vi.advanceTimersByTime(999);
    expect(wsInstances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(wsInstances).toHaveLength(3);
  });

  it('caps backoff at 10 s', () => {
    const onEvent = vi.fn<(e: AgentEvent) => void>();
    subscribe('q1', onEvent);

    // Exhaust the cap by dropping without opening (backoff accumulates on consecutive failures).
    // Sequence: 500 → 1000 → 2000 → 4000 → 8000 → capped at 10 000
    wsInstances[0]._drop();
    vi.advanceTimersByTime(500);   // ws[1]
    wsInstances[1]._drop();
    vi.advanceTimersByTime(1_000); // ws[2]
    wsInstances[2]._drop();
    vi.advanceTimersByTime(2_000); // ws[3]
    wsInstances[3]._drop();
    vi.advanceTimersByTime(4_000); // ws[4]
    wsInstances[4]._drop();
    vi.advanceTimersByTime(8_000); // ws[5] — retryDelay now capped at 10 000

    wsInstances[5]._drop();
    const before = wsInstances.length;
    vi.advanceTimersByTime(9_999);
    expect(wsInstances).toHaveLength(before);  // still waiting
    vi.advanceTimersByTime(1);
    expect(wsInstances).toHaveLength(before + 1); // fires at exactly 10 000 ms
  });
});

// ---------------------------------------------------------------------------
// connectQuestSocket — status-aware API
// ---------------------------------------------------------------------------

describe('connectQuestSocket', () => {
  it('emits connecting on creation, connected on open', () => {
    const statuses: ConnectionStatus[] = [];
    connectQuestSocket('q1', {
      onEvent: vi.fn(),
      onConnectionChange: (s) => statuses.push(s),
    });

    expect(statuses).toEqual(['connecting']);

    wsInstances[0]._open();
    expect(statuses).toEqual(['connecting', 'connected']);
  });

  it('forwards valid events to onEvent', () => {
    const onEvent = vi.fn<(e: AgentEvent) => void>();
    connectQuestSocket('q1', { onEvent });
    wsInstances[0]._open();

    const event: AgentEvent = {
      type: 'progress',
      timestamp: '2024-01-01T00:00:00.000Z',
      message: 'working',
    };
    wsInstances[0]._message(event);
    expect(onEvent).toHaveBeenCalledWith(event);
  });

  it('calls onParseError for malformed JSON without calling onEvent', () => {
    const onEvent = vi.fn();
    const onParseError = vi.fn<(m: string) => void>();
    connectQuestSocket('q1', { onEvent, onParseError });
    wsInstances[0]._open();

    wsInstances[0]._rawMessage('not json {');
    expect(onEvent).not.toHaveBeenCalled();
    expect(onParseError).toHaveBeenCalledTimes(1);
  });

  it('calls onParseError for frames failing schema validation', () => {
    const onEvent = vi.fn();
    const onParseError = vi.fn<(m: string) => void>();
    connectQuestSocket('q1', { onEvent, onParseError });
    wsInstances[0]._open();

    wsInstances[0]._message({ type: 'unknown_type', foo: 'bar' });
    expect(onEvent).not.toHaveBeenCalled();
    expect(onParseError).toHaveBeenCalledTimes(1);
  });

  it('emits connecting on disconnect, closed after close()', () => {
    const statuses: ConnectionStatus[] = [];
    const handle = connectQuestSocket('q1', {
      onEvent: vi.fn(),
      onConnectionChange: (s) => statuses.push(s),
    });
    wsInstances[0]._open();

    wsInstances[0]._drop();
    expect(statuses).toContain('connecting');

    handle.close();
    expect(statuses[statuses.length - 1]).toBe('closed');
  });

  it('does not reconnect after close()', () => {
    const handle = connectQuestSocket('q1', { onEvent: vi.fn() });
    wsInstances[0]._open();

    handle.close();
    vi.advanceTimersByTime(30_000);
    expect(wsInstances).toHaveLength(1);
  });

  it('reconnects with exponential backoff (1s base)', () => {
    connectQuestSocket('q1', { onEvent: vi.fn() });
    wsInstances[0]._open();
    wsInstances[0]._drop();

    expect(wsInstances).toHaveLength(1);
    vi.advanceTimersByTime(999);
    expect(wsInstances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(wsInstances).toHaveLength(2);
  });

  it('caps backoff at 30s', () => {
    connectQuestSocket('q1', { onEvent: vi.fn() });
    // exhaust cap: 1s → 2s → 4s → 8s → 16s → 30s (capped)
    wsInstances[0]._drop();
    vi.advanceTimersByTime(1_000);   // ws[1]
    wsInstances[1]._drop();
    vi.advanceTimersByTime(2_000);   // ws[2]
    wsInstances[2]._drop();
    vi.advanceTimersByTime(4_000);   // ws[3]
    wsInstances[3]._drop();
    vi.advanceTimersByTime(8_000);   // ws[4]
    wsInstances[4]._drop();
    vi.advanceTimersByTime(16_000);  // ws[5] — now capped at 30s

    wsInstances[5]._drop();
    const before = wsInstances.length;
    vi.advanceTimersByTime(29_999);
    expect(wsInstances).toHaveLength(before);
    vi.advanceTimersByTime(1);
    expect(wsInstances).toHaveLength(before + 1);
  });
});
