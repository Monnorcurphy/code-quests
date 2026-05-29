import { AgentEventSchema } from '@code-quests/shared';
import type { AgentEvent } from '@code-quests/shared';
import { logger } from './logger';

const BACKOFF_BASE_MS = 500;
const BACKOFF_MAX_MS = 10_000;
const BACKOFF_FACTOR = 2;

// connectQuestSocket uses 1s / 30s per spec
const CONNECT_BACKOFF_BASE_MS = 1_000;
const CONNECT_BACKOFF_MAX_MS = 30_000;

function wsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/realtime`;
}

export function subscribe(
  questId: string,
  onEvent: (event: AgentEvent) => void,
): () => void {
  let s: WebSocket | null = null;
  let retryDelay = BACKOFF_BASE_MS;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  function send(msg: unknown): void {
    if (s !== null && s.readyState === WebSocket.OPEN) {
      s.send(JSON.stringify(msg));
    }
  }

  function connect(): void {
    const ws = new WebSocket(wsUrl());
    s = ws;

    ws.addEventListener('open', () => {
      retryDelay = BACKOFF_BASE_MS;
      send({ type: 'subscribe', questId });
    });

    ws.addEventListener('message', (evt: MessageEvent) => {
      let raw: unknown;
      try {
        raw = JSON.parse(evt.data as string);
      } catch {
        logger.warn('malformed WebSocket frame (not JSON)');
        return;
      }
      const result = AgentEventSchema.safeParse(raw);
      if (!result.success) {
        logger.warn('dropped malformed AgentEvent frame');
        return;
      }
      onEvent(result.data);
    });

    ws.addEventListener('close', () => {
      if (s === ws) s = null;
      if (!closed) {
        scheduleReconnect();
      }
    });

    ws.addEventListener('error', () => {
      // error is always followed by close; reconnect is handled in the close listener
    });
  }

  function scheduleReconnect(): void {
    const delay = retryDelay;
    retryDelay = Math.min(retryDelay * BACKOFF_FACTOR, BACKOFF_MAX_MS);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (!closed) connect();
    }, delay);
  }

  connect();

  return () => {
    closed = true;
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (s !== null) {
      send({ type: 'unsubscribe', questId });
      s.close();
      s = null;
    }
  };
}

// ---------------------------------------------------------------------------
// connectQuestSocket — status-aware API used by useQuestStream
// ---------------------------------------------------------------------------

export type ConnectionStatus = 'connecting' | 'connected' | 'closed';

export interface ConnectOptions {
  onEvent: (event: AgentEvent) => void;
  onConnectionChange?: (status: ConnectionStatus) => void;
  onParseError?: (message: string) => void;
}

export interface QuestSocketHandle {
  close(): void;
}

export function connectQuestSocket(questId: string, opts: ConnectOptions): QuestSocketHandle {
  let disposed = false;
  let ws: WebSocket | null = null;
  let backoff = CONNECT_BACKOFF_BASE_MS;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function connect(): void {
    if (disposed) return;
    const sock = new WebSocket(wsUrl());
    ws = sock;

    sock.addEventListener('open', () => {
      backoff = CONNECT_BACKOFF_BASE_MS;
      sock.send(JSON.stringify({ type: 'subscribe', questId }));
      opts.onConnectionChange?.('connected');
    });

    sock.addEventListener('message', (evt: MessageEvent) => {
      let raw: unknown;
      try {
        raw = JSON.parse(evt.data as string);
      } catch {
        opts.onParseError?.('Malformed WebSocket frame (not JSON)');
        return;
      }
      const result = AgentEventSchema.safeParse(raw);
      if (!result.success) {
        opts.onParseError?.('Malformed AgentEvent payload');
        return;
      }
      opts.onEvent(result.data);
    });

    sock.addEventListener('close', () => {
      if (ws === sock) ws = null;
      if (!disposed) {
        opts.onConnectionChange?.('connecting');
        scheduleReconnect();
      }
    });

    sock.addEventListener('error', () => {
      // always followed by close; reconnect handled there
    });
  }

  function scheduleReconnect(): void {
    const delay = backoff;
    backoff = Math.min(backoff * BACKOFF_FACTOR, CONNECT_BACKOFF_MAX_MS);
    logger.warn(`reconnecting in ${delay}ms`);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, delay);
  }

  opts.onConnectionChange?.('connecting');
  connect();

  return {
    close(): void {
      disposed = true;
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (ws !== null) {
        // Only send the unsubscribe frame if the socket is actually OPEN;
        // calling send() during CONNECTING throws InvalidStateError and
        // crashes the host component (React StrictMode double-mount made
        // this easy to hit during dev).
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ type: 'unsubscribe', questId }));
          } catch {
            // socket may have transitioned mid-send; nothing to do
          }
        }
        try {
          ws.close();
        } catch {
          // already closing
        }
        ws = null;
      }
      opts.onConnectionChange?.('closed');
    },
  };
}
