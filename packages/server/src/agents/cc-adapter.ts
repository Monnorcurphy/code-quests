import { spawn as nodeSpawn } from 'child_process';
import { delimiter, join } from 'path';
import { writeFile, unlink } from 'fs/promises';
import { accessSync, constants } from 'fs';
import { randomBytes } from 'crypto';
import { tmpdir } from 'os';
import type { AgentEvent, MCPServer } from '@code-quests/shared';
import type { AgentAdapter, AgentHandle, AgentSpawnInput } from './adapter';

export class MissingBinaryError extends Error {
  constructor() {
    super(
      'Claude Code binary not found. Set CODE_QUESTS_CLAUDE_BIN or ensure claude is on PATH.',
    );
    this.name = 'MissingBinaryError';
  }
}

const FAILURE_PATTERNS: Array<{ monsterTypeId: string; regex: RegExp }> = [
  { monsterTypeId: 'goblin_linter', regex: /lint(ing|er?)?|eslint|tslint/i },
  { monsterTypeId: 'imp_typecheck', regex: /type[\s-]?check|TypeScript\s+error|error\s+TS\d+/i },
  { monsterTypeId: 'ogre_failing_test', regex: /tests?\s+failed|FAIL\s+|failing\s+test/i },
];

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

export function findBinPath(): string | null {
  const envBin = process.env.CODE_QUESTS_CLAUDE_BIN;
  if (envBin) {
    try {
      accessSync(envBin, constants.X_OK);
      return envBin;
    } catch {
      return null;
    }
  }

  const dirs = (process.env.PATH ?? '').split(delimiter);
  for (const dir of dirs) {
    const candidate = join(dir, 'claude');
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // not in this directory
    }
  }
  return null;
}

async function writeTempMcpConfig(servers: MCPServer[]): Promise<string> {
  const mcpConfig = {
    mcpServers: Object.fromEntries(servers.map((s) => [s.name, s.config])),
  };
  const name = randomBytes(8).toString('hex');
  const filePath = join(tmpdir(), `cq-mcp-${name}.json`);
  await writeFile(filePath, JSON.stringify(mcpConfig), { encoding: 'utf8', mode: 0o600 });
  return filePath;
}

function buildArgs(cwd: string | undefined, tmpFile: string): string[] {
  const args = ['--print', '--output-format', 'stream-json', '--mcp-config', tmpFile];
  if (cwd) args.push('--cwd', cwd);
  return args;
}

function buildPrompt(input: AgentSpawnInput): string {
  const cls = input.adventurerClass ?? 'adventurer';
  const system = `You are ${input.adventurerName}, a Claude Code ${cls}. Stay within the quest scope.`;
  const acList = input.acceptanceCriteria.map((ac) => `- ${ac}`).join('\n');
  const user = `${input.description}\n\nAcceptance criteria:\n${acList}`;
  return `${system}\n\n${user}`;
}

function extractText(content: unknown[]): string {
  return content
    .filter(
      (c): c is { type: string; text: string } =>
        typeof c === 'object' &&
        c !== null &&
        (c as Record<string, unknown>)['type'] === 'text' &&
        typeof (c as Record<string, unknown>)['text'] === 'string',
    )
    .map((c) => c.text)
    .join('');
}

function parseLine(line: string): AgentEvent | null {
  const timestamp = new Date().toISOString();
  let parsed: unknown;

  try {
    parsed = JSON.parse(line);
  } catch {
    const msg = line.length > 1024 ? line.slice(0, 1024) : line;
    return { type: 'log', timestamp, message: msg };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { type: 'log', timestamp, message: line.slice(0, 1024) };
  }

  const obj = parsed as Record<string, unknown>;

  if (obj['type'] === 'assistant') {
    const msg = obj['message'];
    if (typeof msg !== 'object' || msg === null) return null;
    const content = (msg as Record<string, unknown>)['content'];
    if (!Array.isArray(content)) return null;

    const text = extractText(content);
    if (!text) return null;

    const truncated = text.length > 1024 ? text.slice(0, 1024) : text;
    for (const pattern of FAILURE_PATTERNS) {
      if (pattern.regex.test(text)) {
        return { type: 'combat', timestamp, monsterTypeId: pattern.monsterTypeId, message: truncated };
      }
    }
    return { type: 'progress', timestamp, message: truncated };
  }

  const knownTypes = ['system', 'result', 'tool_use', 'tool_result'];
  if (knownTypes.includes(obj['type'] as string)) return null;

  return { type: 'log', timestamp, message: line.slice(0, 1024) };
}

async function spawnHandle(input: AgentSpawnInput): Promise<AgentHandle> {
  const binPath = findBinPath();
  if (!binPath) throw new MissingBinaryError();

  const tmpFile = await writeTempMcpConfig(input.mcpServers ?? []);
  const queue = new AsyncQueue<AgentEvent>();

  let killTimer: ReturnType<typeof setTimeout> | null = null;
  let exitResolve!: (v: { exitCode: number | null }) => void;
  const exitPromise = new Promise<{ exitCode: number | null }>((r) => {
    exitResolve = r;
  });

  const proc = nodeSpawn(binPath, buildArgs(input.cwd, tmpFile), {
    cwd: input.cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let settled = false;
  const finalize = (code: number | null, reason?: string): void => {
    if (settled) return;
    settled = true;
    if (killTimer !== null) {
      clearTimeout(killTimer);
      killTimer = null;
    }
    const timestamp = new Date().toISOString();
    queue.push(
      code === 0 && !reason
        ? { type: 'completed', timestamp }
        : { type: 'failed', timestamp, reason: reason ?? `exit code ${String(code)}` },
    );
    queue.close();
    void unlink(tmpFile)
      .catch(() => { /* best-effort cleanup */ })
      .then(() => exitResolve({ exitCode: code }));
  };

  proc.on('error', (err: Error) => finalize(null, `spawn error: ${err.message}`));

  try {
    proc.stdin!.write(buildPrompt(input));
    proc.stdin!.end();
  } catch {
    // 'error' handler will fire and finalize; nothing to do here.
  }

  let stdoutBuf = '';

  proc.stdout!.on('data', (chunk: Buffer) => {
    stdoutBuf += chunk.toString('utf8');
    const lines = stdoutBuf.split('\n');
    stdoutBuf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = parseLine(line);
      if (event) queue.push(event);
    }
  });

  proc.stderr!.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf8').trim();
    if (!text) return;
    const truncated = text.length > 1024 ? text.slice(0, 1024) : text;
    queue.push({
      type: 'progress',
      timestamp: new Date().toISOString(),
      message: `warning: ${truncated}`,
    });
  });

  proc.on('close', (code: number | null) => {
    if (stdoutBuf.trim()) {
      const event = parseLine(stdoutBuf);
      if (event) queue.push(event);
    }
    finalize(code);
  });

  return {
    pid: proc.pid ?? null,
    events(): AsyncIterable<AgentEvent> {
      return queue;
    },
    async cancel(): Promise<void> {
      if (settled) return;
      if (killTimer !== null) clearTimeout(killTimer);
      proc.kill('SIGTERM');
      killTimer = setTimeout(() => {
        if (!settled) proc.kill('SIGKILL');
      }, 5000);
    },
    async awaitExit(): Promise<{ exitCode: number | null }> {
      return exitPromise;
    },
  };
}

export function createCcAdapter(): AgentAdapter {
  return {
    name: 'cc',
    spawn: spawnHandle,
  };
}
