import { Router } from 'express';
import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import { homedir } from 'node:os';

// File-system helpers. Today: a native folder picker for the project
// modal. Macs only for now — we shell out to `osascript` to pop the
// native AppleScript "choose folder" dialog. Returns the absolute path
// the user picked (or 404 if they cancelled).

interface PickResult {
  path: string;
  cancelled: boolean;
}

async function pickFolderMac(startPath?: string): Promise<PickResult> {
  // AppleScript snippet: open the folder picker, optionally rooted at
  // startPath, and write the POSIX path to stdout. If the user cancels,
  // AppleScript throws an error; we catch and return cancelled=true.
  const start = startPath && statSync(startPath, { throwIfNoEntry: false })?.isDirectory()
    ? startPath
    : homedir();
  const script = [
    'try',
    `  set chosen to choose folder with prompt "Choose a project folder" default location POSIX file "${start}"`,
    '  return POSIX path of chosen',
    'on error errMsg number errNum',
    '  if errNum is -128 then',
    '    return "__USER_CANCELLED__"',
    '  end if',
    '  error errMsg number errNum',
    'end try',
  ].join('\n');

  return await new Promise<PickResult>((resolve, reject) => {
    const proc = spawn('osascript', ['-e', script], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c: Buffer) => { stdout += c.toString('utf8'); });
    proc.stderr.on('data', (c: Buffer) => { stderr += c.toString('utf8'); });
    proc.on('error', (err) => reject(err));
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `osascript exited with code ${String(code)}`));
        return;
      }
      const out = stdout.trim();
      if (out === '__USER_CANCELLED__' || out === '') {
        resolve({ path: '', cancelled: true });
        return;
      }
      // AppleScript POSIX paths end with a slash for directories — drop it
      // for cleanliness (still resolves to the same dir).
      const path = out.endsWith('/') && out.length > 1 ? out.slice(0, -1) : out;
      resolve({ path, cancelled: false });
    });
  });
}

export function createFsRouter(): Router {
  const router = Router();

  router.post('/pick-folder', async (req, res) => {
    if (process.platform !== 'darwin') {
      res.status(501).json({
        error: `Native folder picker is only wired for macOS in this build. Type the absolute path manually.`,
        platform: process.platform,
      });
      return;
    }

    const body = req.body as { startPath?: string } | undefined;
    try {
      const result = await pickFolderMac(body?.startPath);
      if (result.cancelled) {
        res.status(204).end();
        return;
      }
      res.json({ path: result.path });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Folder picker failed: ${msg}` });
    }
  });

  return router;
}
