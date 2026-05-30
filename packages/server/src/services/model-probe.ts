import { spawn } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';

// "What can I actually use?" — runtime detection for each provider so the
// Add Model form doesn't make the user guess at ids that might not work.
// All probes are best-effort; if a probe fails we return a friendly hint
// instead of erroring.

export interface ClaudeCliProbe {
  provider: 'claude_cli';
  installed: boolean;
  binPath?: string;
  version?: string;
  suggestedIds: string[];
  hint: string;
}

export interface OllamaProbe {
  provider: 'ollama';
  reachable: boolean;
  baseUrl: string;
  installedModels: Array<{ name: string; size?: string }>;
  hint: string;
}

export interface OpenRouterProbe {
  provider: 'openrouter';
  // OpenRouter probing requires a key, which we don't have at form-fill
  // time. Just point users at the catalogue.
  hint: string;
  catalogueUrl: string;
  popularIds: string[];
}

export type ProbeResult = ClaudeCliProbe | OllamaProbe | OpenRouterProbe;

function findClaudeBin(): string | null {
  const envBin = process.env['CODE_QUESTS_CLAUDE_BIN'];
  if (envBin) {
    try {
      accessSync(envBin, constants.X_OK);
      return envBin;
    } catch {
      return null;
    }
  }
  const dirs = (process.env['PATH'] ?? '').split(delimiter);
  for (const dir of dirs) {
    const candidate = join(dir, 'claude');
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // not here
    }
  }
  return null;
}

async function spawnCapture(
  cmd: string,
  args: string[],
  timeoutMs = 3000,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return await new Promise((resolve) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
    }, timeoutMs);
    proc.stdout.on('data', (c: Buffer) => { stdout += c.toString('utf8'); });
    proc.stderr.on('data', (c: Buffer) => { stderr += c.toString('utf8'); });
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
    proc.on('error', () => {
      clearTimeout(timer);
      resolve({ stdout: '', stderr: '', code: -1 });
    });
  });
}

async function probeClaudeCli(): Promise<ClaudeCliProbe> {
  const binPath = findClaudeBin();
  if (!binPath) {
    return {
      provider: 'claude_cli',
      installed: false,
      suggestedIds: ['sonnet', 'opus', 'haiku'],
      hint: 'The `claude` binary is not on your PATH. Install Claude Code from https://claude.com/claude-code, then refresh.',
    };
  }
  const ver = await spawnCapture(binPath, ['--version']);
  const version = ver.stdout.trim() || ver.stderr.trim() || undefined;
  return {
    provider: 'claude_cli',
    installed: true,
    binPath,
    ...(version !== undefined ? { version } : {}),
    suggestedIds: ['sonnet', 'opus', 'haiku'],
    hint: `Found at ${binPath}${version ? ` (${version})` : ''}. The CLI accepts model aliases (sonnet / opus / haiku) or full ids — pick whichever you'd like to use.`,
  };
}

async function probeOllama(baseUrl?: string): Promise<OllamaProbe> {
  const url = baseUrl ?? 'http://localhost:11434';
  try {
    const res = await fetch(`${url}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) {
      return {
        provider: 'ollama',
        reachable: false,
        baseUrl: url,
        installedModels: [],
        hint: `Reached ${url} but got HTTP ${res.status}. Make sure Ollama is running.`,
      };
    }
    const data = (await res.json()) as { models?: Array<{ name: string; size?: number }> };
    const installed = (data.models ?? []).map((m) => ({
      name: m.name,
      ...(m.size !== undefined
        ? { size: `${(m.size / 1024 / 1024 / 1024).toFixed(1)} GB` }
        : {}),
    }));
    return {
      provider: 'ollama',
      reachable: true,
      baseUrl: url,
      installedModels: installed,
      hint:
        installed.length === 0
          ? `Ollama is running at ${url} but no models are pulled yet. Try: ollama pull llama3.1:8b`
          : `Ollama is running. You have ${installed.length} model${installed.length === 1 ? '' : 's'} installed — pick one below.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const conn = msg.includes('ECONNREFUSED') || msg.includes('fetch failed');
    return {
      provider: 'ollama',
      reachable: false,
      baseUrl: url,
      installedModels: [],
      hint: conn
        ? `Could not reach Ollama at ${url}. Install from https://ollama.com, then run \`ollama serve\`.`
        : `Probe failed: ${msg}`,
    };
  }
}

function probeOpenRouter(): OpenRouterProbe {
  return {
    provider: 'openrouter',
    hint:
      'OpenRouter is a pay-per-token gateway to many providers. You\'ll need an API key (get one at openrouter.ai/keys). Pick a model from the catalogue and paste its full id below.',
    catalogueUrl: 'https://openrouter.ai/models',
    popularIds: [
      'anthropic/claude-3.5-sonnet',
      'anthropic/claude-3-haiku',
      'google/gemini-flash-1.5',
      'meta-llama/llama-3.3-70b-instruct',
      'deepseek/deepseek-chat',
      'openai/gpt-4o-mini',
    ],
  };
}

export async function probeProvider(
  provider: 'claude_cli' | 'ollama' | 'openrouter',
  baseUrl?: string,
): Promise<ProbeResult> {
  switch (provider) {
    case 'claude_cli':
      return await probeClaudeCli();
    case 'ollama':
      return await probeOllama(baseUrl);
    case 'openrouter':
      return probeOpenRouter();
  }
}
