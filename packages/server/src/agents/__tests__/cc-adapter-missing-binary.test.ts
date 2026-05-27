import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { rm } from 'fs/promises';
import { createCcAdapter, MissingBinaryError } from '../cc-adapter';

const SPAWN_INPUT = {
  questId: 'q1',
  adventurerId: 'adv1',
  adventurerName: 'Aria',
  modelId: 'cc',
  description: 'Test quest',
  acceptanceCriteria: [],
  equipment: { skillIds: [], toolIds: [], mcpServerIds: [] },
};

describe('cc-adapter — missing binary', () => {
  let emptyDir: string;
  let origBin: string | undefined;
  let origPath: string | undefined;

  beforeAll(() => {
    emptyDir = mkdtempSync(join(tmpdir(), 'cc-empty-'));
    origBin = process.env.CODE_QUESTS_CLAUDE_BIN;
    origPath = process.env.PATH;
    delete process.env.CODE_QUESTS_CLAUDE_BIN;
    process.env.PATH = emptyDir;
  });

  afterAll(async () => {
    if (origBin !== undefined) {
      process.env.CODE_QUESTS_CLAUDE_BIN = origBin;
    } else {
      delete process.env.CODE_QUESTS_CLAUDE_BIN;
    }
    process.env.PATH = origPath ?? '';
    await rm(emptyDir, { recursive: true, force: true });
  });

  it('spawn() throws MissingBinaryError when binary is not found', async () => {
    const adapter = createCcAdapter();
    await expect(adapter.spawn!(SPAWN_INPUT)).rejects.toThrow(MissingBinaryError);
  });

  it('spawn() throws MissingBinaryError with descriptive message', async () => {
    const adapter = createCcAdapter();
    await expect(adapter.spawn!(SPAWN_INPUT)).rejects.toThrow(
      'Claude Code binary not found',
    );
  });
});
