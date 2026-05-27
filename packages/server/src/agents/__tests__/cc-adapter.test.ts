import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, chmodSync, readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { rm } from 'fs/promises';
import { createCcAdapter } from '../cc-adapter';
import type { AgentEvent } from '@code-quests/shared';

const SPAWN_INPUT = {
  questId: 'quest-1',
  adventurerId: 'adv-1',
  adventurerName: 'Aria',
  adventurerClass: 'champion',
  modelId: 'cc',
  description: 'Defeat the goblin and return victorious.',
  acceptanceCriteria: ['Goblin defeated', 'Return to town'],
  equipment: { skillIds: [], toolIds: [], mcpServerIds: [] },
  mcpServers: [{ id: 'srv1', name: 'test-server', config: { command: 'echo' } }],
};

function makeFakeScript(lines: string[], exitCode = 0): string {
  const jsonLines = lines.map((l) => `process.stdout.write(${JSON.stringify(l)} + '\\n');`).join('\n');
  return `#!/usr/bin/env node\n${jsonLines}\nprocess.exit(${exitCode});\n`;
}

function getMcpTempFiles(): string[] {
  return readdirSync(tmpdir()).filter((n) => n.startsWith('cq-mcp-'));
}

describe('cc-adapter', () => {
  let testTmpDir: string;
  let origBin: string | undefined;

  let fakeBinSuccess: string;
  let fakeBinFail: string;
  let fakeBinSlow: string;

  beforeAll(() => {
    origBin = process.env.CODE_QUESTS_CLAUDE_BIN;
    testTmpDir = mkdtempSync(join(tmpdir(), 'cc-test-'));

    fakeBinSuccess = join(testTmpDir, 'fake-claude-success');
    writeFileSync(
      fakeBinSuccess,
      makeFakeScript([
        JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Starting quest' }] } }),
        JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Running checks' }] } }),
        JSON.stringify({ type: 'result', subtype: 'success', result: 'Done' }),
      ]),
    );
    chmodSync(fakeBinSuccess, 0o755);

    fakeBinFail = join(testTmpDir, 'fake-claude-fail');
    writeFileSync(
      fakeBinFail,
      makeFakeScript(
        [JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Oops' }] } })],
        1,
      ),
    );
    chmodSync(fakeBinFail, 0o755);

    fakeBinSlow = join(testTmpDir, 'fake-claude-slow');
    writeFileSync(
      fakeBinSlow,
      `#!/usr/bin/env node
process.stdout.write(${JSON.stringify(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Starting quest' }] } }))} + '\\n');
setTimeout(() => { process.exit(0); }, 60000);
`,
    );
    chmodSync(fakeBinSlow, 0o755);
  });

  afterAll(async () => {
    if (origBin !== undefined) {
      process.env.CODE_QUESTS_CLAUDE_BIN = origBin;
    } else {
      delete process.env.CODE_QUESTS_CLAUDE_BIN;
    }
    await rm(testTmpDir, { recursive: true, force: true });
  });

  it('streams events in order, emits completed, and cleans up temp .mcp.json', async () => {
    process.env.CODE_QUESTS_CLAUDE_BIN = fakeBinSuccess;
    const before = getMcpTempFiles();

    const adapter = createCcAdapter();
    const handle = await adapter.spawn!(SPAWN_INPUT);
    expect(handle.pid).not.toBeNull();

    const events: AgentEvent[] = [];
    for await (const ev of handle.events()) {
      events.push(ev);
    }

    expect(events.length).toBeGreaterThanOrEqual(3);
    expect(events[0]).toMatchObject({ type: 'progress', message: 'Starting quest' });
    expect(events[1]).toMatchObject({ type: 'progress', message: 'Running checks' });
    expect(events.at(-1)).toMatchObject({ type: 'completed' });

    const { exitCode } = await handle.awaitExit();
    expect(exitCode).toBe(0);

    const after = getMcpTempFiles();
    const newFiles = after.filter((f) => !before.includes(f));
    expect(newFiles).toHaveLength(0);
  });

  it('emits failed event on non-zero exit and cleans up temp .mcp.json', async () => {
    process.env.CODE_QUESTS_CLAUDE_BIN = fakeBinFail;
    const before = getMcpTempFiles();

    const adapter = createCcAdapter();
    const handle = await adapter.spawn!(SPAWN_INPUT);

    const events: AgentEvent[] = [];
    for await (const ev of handle.events()) {
      events.push(ev);
    }

    expect(events.at(-1)).toMatchObject({ type: 'failed' });

    const { exitCode } = await handle.awaitExit();
    expect(exitCode).not.toBe(0);

    const after = getMcpTempFiles();
    const newFiles = after.filter((f) => !before.includes(f));
    expect(newFiles).toHaveLength(0);
  });

  it('cancel() terminates the subprocess and closes the event stream', async () => {
    process.env.CODE_QUESTS_CLAUDE_BIN = fakeBinSlow;
    const before = getMcpTempFiles();

    const adapter = createCcAdapter();
    const handle = await adapter.spawn!(SPAWN_INPUT);

    const events: AgentEvent[] = [];
    const drainPromise = (async () => {
      for await (const ev of handle.events()) {
        events.push(ev);
      }
    })();

    await new Promise<void>((r) => setImmediate(r));
    await handle.cancel();
    await drainPromise;

    expect(events.length).toBeGreaterThanOrEqual(1);
    const last = events.at(-1);
    expect(last?.type === 'failed' || last?.type === 'completed').toBe(true);

    await handle.awaitExit();

    const after = getMcpTempFiles();
    const newFiles = after.filter((f) => !before.includes(f));
    expect(newFiles).toHaveLength(0);
  });
});
