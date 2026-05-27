import { AgentEventSchema } from '@code-quests/shared';
import type { AgentEvent } from '@code-quests/shared';
import { logger } from './logger';

const BACKOFF_BASE_MS = 500;
const BACKOFF_MAX_MS = 10_000;
const BACKOFF_FACTOR = 2;

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
