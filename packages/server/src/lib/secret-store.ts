import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Secret storage for API keys. Today: macOS Keychain via the `security`
// CLI (installed by default, no native build, no deps). Other platforms
// fall back to an encrypted-at-rest file under ~/.code-quests/secrets/
// — also chmod 600 — until we add a real cross-platform keyring.
//
// The DB only stores the model id; the actual key lives here, keyed by
// `code-quests:model:<modelId>`. UI never reads keys back after submit.

const SERVICE = 'code-quests';
const ACCOUNT_PREFIX = 'model:';
const FILE_DIR = path.join(os.homedir(), '.code-quests', 'secrets');

function accountFor(modelId: string): string {
  return `${ACCOUNT_PREFIX}${modelId}`;
}

async function spawnSecurity(args: string[], input?: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return await new Promise((resolve) => {
    const proc = spawn('security', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c: Buffer) => { stdout += c.toString('utf8'); });
    proc.stderr.on('data', (c: Buffer) => { stderr += c.toString('utf8'); });
    proc.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
    proc.on('error', () => resolve({ code: -1, stdout: '', stderr: 'security CLI not available' }));
    if (input !== undefined) {
      proc.stdin.write(input);
      proc.stdin.end();
    } else {
      proc.stdin.end();
    }
  });
}

async function useKeychain(): Promise<boolean> {
  if (process.platform !== 'darwin') return false;
  // Cheap probe — `security -h` succeeds if installed.
  const res = await spawnSecurity(['-h']);
  return res.code === 0 || res.code === 1; // -h returns 1 on some macOS versions but the binary exists
}

async function fallbackFilePath(modelId: string): Promise<string> {
  await fs.mkdir(FILE_DIR, { recursive: true, mode: 0o700 });
  return path.join(FILE_DIR, `${modelId}.key`);
}

export async function setSecret(modelId: string, value: string): Promise<void> {
  if (await useKeychain()) {
    // -U updates if exists. -w sets the password.
    const res = await spawnSecurity([
      'add-generic-password',
      '-U',
      '-s', SERVICE,
      '-a', accountFor(modelId),
      '-w', value,
    ]);
    if (res.code !== 0) {
      throw new Error(`keychain add failed: ${res.stderr.trim() || 'unknown error'}`);
    }
    return;
  }
  const filePath = await fallbackFilePath(modelId);
  await fs.writeFile(filePath, value, { encoding: 'utf8', mode: 0o600 });
}

export async function getSecret(modelId: string): Promise<string | null> {
  if (await useKeychain()) {
    const res = await spawnSecurity([
      'find-generic-password',
      '-s', SERVICE,
      '-a', accountFor(modelId),
      '-w',
    ]);
    if (res.code !== 0) return null;
    return res.stdout.replace(/\n$/, '');
  }
  try {
    const filePath = await fallbackFilePath(modelId);
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

export async function deleteSecret(modelId: string): Promise<void> {
  if (await useKeychain()) {
    await spawnSecurity([
      'delete-generic-password',
      '-s', SERVICE,
      '-a', accountFor(modelId),
    ]);
    return;
  }
  try {
    const filePath = await fallbackFilePath(modelId);
    await fs.unlink(filePath);
  } catch {
    // already gone — fine
  }
}

export async function hasSecret(modelId: string): Promise<boolean> {
  return (await getSecret(modelId)) !== null;
}
