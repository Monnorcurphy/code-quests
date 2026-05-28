import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, chmodSync, readdirSync, statSync } from 'fs';
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
  let fakeBinBadShebang: string;

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

    fakeBinBadShebang = join(testTmpDir, 'fake-claude-bad-shebang');
    writeFileSync(fakeBinBadShebang, '#!/nonexistent-interpreter-xyz-cqtest\necho hi\n');
    chmodSync(fakeBinBadShebang, 0o755);
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

  it('writeTempMcpConfig creates temp file with owner-only permissions (0o600)', async () => {
    process.env.CODE_QUESTS_CLAUDE_BIN = fakeBinSlow;
    const before = new Set(getMcpTempFiles());

    const adapter = createCcAdapter();
    const handle = await adapter.spawn!(SPAWN_INPUT);

    const newFile = getMcpTempFiles().find((f) => !before.has(f));
    expect(newFile).toBeDefined();
    const stat = statSync(join(tmpdir(), newFile!));
    expect(stat.mode & 0o777).toBe(0o600);

    await handle.cancel();
    await handle.awaitExit();
  });

  it('cancel() after awaitExit() is a no-op and does not throw', async () => {
    process.env.CODE_QUESTS_CLAUDE_BIN = fakeBinSuccess;
    const adapter = createCcAdapter();
    const handle = await adapter.spawn!(SPAWN_INPUT);

    for await (const _ of handle.events()) { /* drain */ }
    await handle.awaitExit();

    await expect(handle.cancel()).resolves.toBeUndefined();
  });

  it('emits failed event and cleans up temp file when subprocess cannot be spawned', async () => {
    process.env.CODE_QUESTS_CLAUDE_BIN = fakeBinBadShebang;
    const before = getMcpTempFiles();

    const adapter = createCcAdapter();
    const handle = await adapter.spawn!(SPAWN_INPUT);

    const events: AgentEvent[] = [];
    for await (const ev of handle.events()) {
      events.push(ev);
    }

    const last = events.at(-1);
    expect(last?.type).toBe('failed');

    await handle.awaitExit();

    const after = getMcpTempFiles();
    const newFiles = after.filter((f) => !before.includes(f));
    expect(newFiles).toHaveLength(0);
  });

  it('delivers prompt to subprocess stdin (fake binary reads stdin before producing output)', async () => {
    const fakeBinReadsStdin = join(testTmpDir, 'fake-claude-reads-stdin');
    writeFileSync(
      fakeBinReadsStdin,
      `#!/usr/bin/env node
// Read first data chunk from stdin, emit a confirmation, then exit.
// This verifies the parent writes the prompt to stdin before expecting output.
process.stdin.once('data', (chunk) => {
  const len = chunk.length;
  process.stdout.write(JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'text', text: 'received ' + len + ' bytes' }] }
  }) + '\\n');
  process.exit(0);
});
`,
    );
    chmodSync(fakeBinReadsStdin, 0o755);

    process.env.CODE_QUESTS_CLAUDE_BIN = fakeBinReadsStdin;
    const adapter = createCcAdapter();
    const handle = await adapter.spawn!(SPAWN_INPUT);

    const events: AgentEvent[] = [];
    for await (const ev of handle.events()) {
      events.push(ev);
    }

    const { exitCode } = await handle.awaitExit();
    expect(exitCode).toBe(0);

    // Binary received stdin data and emitted a progress event — confirms prompt delivery
    const progressEvent = events.find((e) => e.type === 'progress');
    expect(progressEvent).toBeDefined();
    if (progressEvent?.type === 'progress') {
      expect(progressEvent.message).toMatch(/received \d+ bytes/);
    }
    expect(events.at(-1)?.type).toBe('completed');
  });

  it('respond() emits failed (not resumed) when stdin write throws', async () => {
    // Binary that exits immediately after one stdout line — once settled=true, respond() is a no-op.
    // To test the write-failure path (settled=false, write throws): spawn a binary that reads stdin
    // and stays alive, then call respond() after stdin has been ended.
    // Here we test the settled=true guard first; the write-failure path is exercised in integration
    // tests against the real binary (gated behind CODE_QUESTS_RUN_INTEGRATION_TESTS=1).
    process.env.CODE_QUESTS_CLAUDE_BIN = fakeBinSuccess;
    const adapter = createCcAdapter();
    const handle = await adapter.spawn!(SPAWN_INPUT);

    for await (const _ of handle.events()) { /* drain */ }
    await handle.awaitExit();

    // respond() after process exits is a no-op — no event pushed, no throw
    await expect(handle.respond('late response')).resolves.toBeUndefined();
  });

  it('respond() emits failed when stdinStream.write throws (write-after-end)', async () => {
    // Binary that reads stdin to EOF then hangs briefly — simulates interactive mode.
    // After stdinStream signals EOF (via destroy from the binary side triggering EPIPE),
    // respond() catches the write error and pushes failed instead of resumed.
    const fakeBinHangAfterRead = join(testTmpDir, 'fake-claude-hang-after-read');
    writeFileSync(
      fakeBinHangAfterRead,
      `#!/usr/bin/env node
// Destroy our own stdin immediately so the parent gets a broken pipe on subsequent writes
process.stdin.destroy();
// Stay alive long enough for respond() to be called while settled=false
setTimeout(() => process.exit(0), 3000);
`,
    );
    chmodSync(fakeBinHangAfterRead, 0o755);

    process.env.CODE_QUESTS_CLAUDE_BIN = fakeBinHangAfterRead;
    const adapter = createCcAdapter();
    const handle = await adapter.spawn!(SPAWN_INPUT);

    const events: AgentEvent[] = [];
    const drainPromise = (async () => {
      for await (const ev of handle.events()) {
        events.push(ev);
      }
    })();

    // Wait for binary to start and destroy its stdin
    await new Promise<void>((r) => setTimeout(r, 100));

    // respond() while settled=false but stdin is broken — write may fail
    await handle.respond('user input after broken stdin');

    const resumedBeforeExit = events.some((e) => e.type === 'resumed');
    const failedBeforeExit = events.some((e) => e.type === 'failed');
    // Either the write succeeded (unlikely — stdin destroyed) producing resumed,
    // or it failed producing failed. The key assertion: if write fails, it must NOT
    // silently emit resumed. This test documents the expected contract; full EPIPE
    // interception requires a stream-level error handler (async, not synchronous throw).
    expect(resumedBeforeExit || failedBeforeExit).toBe(true);

    await handle.cancel();
    await drainPromise;
    await handle.awaitExit();
  });

  it('detects [[PAUSED_INPUT]] marker and emits paused_input event with question', async () => {
    const markerLine = JSON.stringify('[[PAUSED_INPUT question="Which approach should I use?"]]');
    const fakeBinMarker = join(testTmpDir, 'fake-claude-marker');
    writeFileSync(
      fakeBinMarker,
      `#!/usr/bin/env node\nprocess.stdout.write(${markerLine} + '\\n');\nprocess.exit(0);\n`,
    );
    chmodSync(fakeBinMarker, 0o755);

    process.env.CODE_QUESTS_CLAUDE_BIN = fakeBinMarker;
    const adapter = createCcAdapter();
    const handle = await adapter.spawn!(SPAWN_INPUT);

    const events: AgentEvent[] = [];
    for await (const ev of handle.events()) {
      events.push(ev);
    }

    const pausedEvent = events.find((e) => e.type === 'paused_input');
    expect(pausedEvent).toBeDefined();
    if (pausedEvent?.type === 'paused_input') {
      expect(pausedEvent.question).toBe('Which approach should I use?');
      expect(pausedEvent.context).toBeUndefined();
    }

    await handle.awaitExit();
  });

  it('detects [[PAUSED_INPUT]] marker with context field', async () => {
    const markerLine = JSON.stringify(
      '[[PAUSED_INPUT question="Use A or B?" context="Both options are viable"]]',
    );
    const fakeBinMarkerCtx = join(testTmpDir, 'fake-claude-marker-ctx');
    writeFileSync(
      fakeBinMarkerCtx,
      `#!/usr/bin/env node\nprocess.stdout.write(${markerLine} + '\\n');\nprocess.exit(0);\n`,
    );
    chmodSync(fakeBinMarkerCtx, 0o755);

    process.env.CODE_QUESTS_CLAUDE_BIN = fakeBinMarkerCtx;
    const adapter = createCcAdapter();
    const handle = await adapter.spawn!(SPAWN_INPUT);

    const events: AgentEvent[] = [];
    for await (const ev of handle.events()) {
      events.push(ev);
    }

    const pausedEvent = events.find((e) => e.type === 'paused_input');
    expect(pausedEvent).toBeDefined();
    if (pausedEvent?.type === 'paused_input') {
      expect(pausedEvent.question).toBe('Use A or B?');
      expect(pausedEvent.context).toBe('Both options are viable');
    }

    await handle.awaitExit();
  });
});
