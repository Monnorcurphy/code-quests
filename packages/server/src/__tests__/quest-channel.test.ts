import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'http';
import WebSocket from 'ws';
import type { AgentEvent } from '@code-quests/shared';
import {
  attachQuestChannel,
  isLoopbackAddress,
  QuestChannel,
} from '../realtime/quest-channel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startServer(): Promise<{ server: http.Server; channel: QuestChannel; port: number }> {
  return new Promise((resolve) => {
    const server = http.createServer();
    const channel = attachQuestChannel(server);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
      resolve({ server, channel, port });
    });
  });
}

function stopServer(channel: QuestChannel, server: http.Server): Promise<void> {
  return new Promise((resolve) => {
    channel.close(() => server.close(() => resolve()));
  });
}

function connectClient(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/realtime`);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function collectMessages(ws: WebSocket): AgentEvent[] {
  const received: AgentEvent[] = [];
  ws.on('message', (data) => {
    received.push(JSON.parse(data.toString()) as AgentEvent);
  });
  return received;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Unit tests — IP check
// ---------------------------------------------------------------------------

describe('isLoopbackAddress', () => {
  it('returns true for 127.0.0.1', () => {
    expect(isLoopbackAddress('127.0.0.1')).toBe(true);
  });

  it('returns true for ::1', () => {
    expect(isLoopbackAddress('::1')).toBe(true);
  });

  it('returns true for IPv4-mapped loopback ::ffff:127.0.0.1', () => {
    expect(isLoopbackAddress('::ffff:127.0.0.1')).toBe(true);
  });

  it('returns false for a LAN address', () => {
    expect(isLoopbackAddress('192.168.1.1')).toBe(false);
  });

  it('returns false for a public IP', () => {
    expect(isLoopbackAddress('8.8.8.8')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

describe('QuestChannel integration', () => {
  let server: http.Server;
  let channel: QuestChannel;
  let port: number;

  beforeEach(async () => {
    ({ server, channel, port } = await startServer());
  });

  afterEach(async () => {
    await stopServer(channel, server);
  });

  it('accepts loopback connections', async () => {
    const ws = await connectClient(port);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  it('delivers published events only to the subscribed quest', async () => {
    const ws = await connectClient(port);
    const received = collectMessages(ws);

    ws.send(JSON.stringify({ type: 'subscribe', questId: 'q1' }));
    await wait(50);

    const event1: AgentEvent = { type: 'progress', timestamp: '2024-01-01T00:00:00.000Z', message: 'msg' };
    const event2: AgentEvent = { type: 'log', timestamp: '2024-01-01T00:00:01.000Z', message: 'log' };

    channel.publishQuestEvent('q1', event1);
    channel.publishQuestEvent('q2', event2); // different quest — must NOT arrive

    await wait(50);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(event1);

    ws.close();
  });

  it('does not deliver events before subscribing', async () => {
    const ws = await connectClient(port);
    const received = collectMessages(ws);

    // Publish without subscribing first
    channel.publishQuestEvent('q1', { type: 'log', timestamp: '2024-01-01T00:00:00.000Z', message: 'hello' });
    await wait(50);

    expect(received).toHaveLength(0);
    ws.close();
  });

  it('stops delivering events after unsubscribe', async () => {
    const ws = await connectClient(port);
    const received = collectMessages(ws);

    ws.send(JSON.stringify({ type: 'subscribe', questId: 'q1' }));
    await wait(50);

    ws.send(JSON.stringify({ type: 'unsubscribe', questId: 'q1' }));
    await wait(50);

    channel.publishQuestEvent('q1', { type: 'log', timestamp: '2024-01-01T00:00:00.000Z', message: 'after unsub' });
    await wait(50);

    expect(received).toHaveLength(0);
    ws.close();
  });

  it('rejects unknown message types with an error frame', async () => {
    const ws = await connectClient(port);

    const errors: unknown[] = [];
    ws.on('message', (data) => {
      const parsed = JSON.parse(data.toString()) as Record<string, unknown>;
      if (typeof parsed.error === 'string') errors.push(parsed);
    });

    ws.send(JSON.stringify({ type: 'unknown_type', questId: 'q1' }));
    await wait(50);

    expect(errors).toHaveLength(1);
    ws.close();
  });

  it('two clients subscribed to different quests receive only their events', async () => {
    const ws1 = await connectClient(port);
    const ws2 = await connectClient(port);
    const recv1 = collectMessages(ws1);
    const recv2 = collectMessages(ws2);

    ws1.send(JSON.stringify({ type: 'subscribe', questId: 'q1' }));
    ws2.send(JSON.stringify({ type: 'subscribe', questId: 'q2' }));
    await wait(50);

    const e1: AgentEvent = { type: 'progress', timestamp: '2024-01-01T00:00:00.000Z', message: 'for q1' };
    const e2: AgentEvent = { type: 'progress', timestamp: '2024-01-01T00:00:01.000Z', message: 'for q2' };

    channel.publishQuestEvent('q1', e1);
    channel.publishQuestEvent('q2', e2);
    await wait(50);

    expect(recv1).toEqual([e1]);
    expect(recv2).toEqual([e2]);

    ws1.close();
    ws2.close();
  });
});
