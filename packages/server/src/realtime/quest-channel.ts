import * as http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { z } from 'zod';
import type { AgentEvent } from '@code-quests/shared';

const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('subscribe'), questId: z.string().min(1) }),
  z.object({ type: z.literal('unsubscribe'), questId: z.string().min(1) }),
]);

const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const PING_INTERVAL_MS = 30_000;
const IDLE_TIMEOUT_MS = 60_000;

interface SocketState {
  questIds: Set<string>;
  lastPong: number;
  pingTimer: ReturnType<typeof setInterval> | undefined;
}

const socketStates = new WeakMap<WebSocket, SocketState>();

export function isLoopbackAddress(addr: string): boolean {
  return LOOPBACK_IPS.has(addr);
}

export class QuestChannel {
  private readonly wss: WebSocketServer;

  constructor(wss: WebSocketServer) {
    this.wss = wss;
  }

  publishQuestEvent(questId: string, event: AgentEvent): void {
    const payload = JSON.stringify(event);
    for (const client of this.wss.clients) {
      const state = socketStates.get(client);
      if (client.readyState === WebSocket.OPEN && state?.questIds.has(questId)) {
        client.send(payload);
      }
    }
  }

  close(cb?: () => void): void {
    for (const client of this.wss.clients) {
      client.terminate();
    }
    this.wss.close(cb);
  }
}

export function attachQuestChannel(server: http.Server): QuestChannel {
  const wss = new WebSocketServer({ server, path: '/realtime' });

  wss.on('connection', (socket, req) => {
    const remoteAddr = req.socket.remoteAddress ?? '';
    if (!isLoopbackAddress(remoteAddr)) {
      socket.close(1008, 'Forbidden');
      return;
    }

    const state: SocketState = {
      questIds: new Set(),
      lastPong: Date.now(),
      pingTimer: undefined,
    };
    socketStates.set(socket, state);

    socket.on('pong', () => {
      state.lastPong = Date.now();
    });

    state.pingTimer = setInterval(() => {
      if (Date.now() - state.lastPong > IDLE_TIMEOUT_MS) {
        socket.terminate();
        return;
      }
      if (socket.readyState === WebSocket.OPEN) {
        socket.ping();
      }
    }, PING_INTERVAL_MS);

    socket.on('close', () => {
      clearInterval(state.pingTimer);
    });

    socket.on('message', (data) => {
      let raw: unknown;
      try {
        raw = JSON.parse(data.toString());
      } catch {
        socket.send(JSON.stringify({ error: 'invalid JSON' }));
        return;
      }
      const result = ClientMessageSchema.safeParse(raw);
      if (!result.success) {
        socket.send(JSON.stringify({ error: 'invalid message' }));
        return;
      }
      const msg = result.data;
      if (msg.type === 'subscribe') {
        state.questIds.add(msg.questId);
      } else {
        state.questIds.delete(msg.questId);
      }
    });
  });

  return new QuestChannel(wss);
}
