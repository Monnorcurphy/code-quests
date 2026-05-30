import { spawn } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';
import type { Model } from '@code-quests/shared';

// Council = a pre-dispatch chat where a (cheap) model helps the user
// refine a draft quest into a precise spec. Not a quest itself — no
// adventurer, no working directory, no scenes. Just chat.
//
// This deliberately bypasses the AgentAdapter interface so council
// queries don't get tangled with quest dispatch semantics (status
// transitions, event publishing, scar/monster tracking, etc.).

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CouncilTurn {
  model: Model;
  apiKey?: string;
  messages: ChatMessage[];
}

export interface CouncilReply {
  reply: string;
  tokenUsage?: { input?: number; output?: number };
}

export const COUNCIL_SYSTEM_PROMPT = `You are the Council — a panel of seasoned adventurers who help quest-givers refine their plans before sending heroes off on dangerous missions.

Your job:
1. Read the draft quest carefully.
2. Ask one or two sharp clarifying questions at a time. Don't interrogate.
3. When the user answers, suggest concrete refinements (sharper title, more specific acceptance criteria, hidden edge cases, missing context).
4. When the user is satisfied, summarise the final spec as bullet points so they can paste it into the quest form.

Stay tight. Be skeptical of vague phrasing. Surface ambiguity in the ACs. Don't try to do the work yourself — your role is to make the spec dispatchable, not to dispatch it.`;

export class CouncilProviderError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface OpenRouterChoice {
  message?: { content?: string };
}
interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

async function callOpenRouter(turn: CouncilTurn): Promise<CouncilReply> {
  if (!turn.apiKey) {
    throw new CouncilProviderError('OpenRouter council requires an API key', 400);
  }
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${turn.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': turn.model.config.siteUrl ?? 'https://github.com/code-quests',
      'X-Title': turn.model.config.siteName ?? 'Code Quests (Council)',
    },
    body: JSON.stringify({
      model: turn.model.modelId,
      messages: turn.messages,
      stream: false,
      temperature: turn.model.config.temperature ?? 0.4,
      max_tokens: turn.model.config.maxTokens ?? 1024,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new CouncilProviderError(
      `OpenRouter rejected the request (${res.status}): ${text.slice(0, 400)}`,
      502,
    );
  }
  const json = (await res.json()) as OpenRouterResponse;
  const content = json.choices?.[0]?.message?.content ?? '';
  if (!content) {
    throw new CouncilProviderError('OpenRouter returned no content', 502);
  }
  return {
    reply: content,
    tokenUsage: {
      input: json.usage?.prompt_tokens,
      output: json.usage?.completion_tokens,
    },
  };
}

interface OllamaResponse {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
}

async function callOllama(turn: CouncilTurn): Promise<CouncilReply> {
  const baseUrl = turn.model.config.baseUrl ?? 'http://localhost:11434';
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: turn.model.modelId,
        messages: turn.messages,
        stream: false,
        options: { temperature: turn.model.config.temperature ?? 0.4 },
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      throw new CouncilProviderError(
        `Could not reach Ollama at ${baseUrl}. Install from https://ollama.com or set baseUrl in the model config.`,
        502,
      );
    }
    throw new CouncilProviderError(`Ollama call failed: ${msg}`, 502);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new CouncilProviderError(
      `Ollama rejected the request (${res.status}): ${text.slice(0, 400)}`,
      502,
    );
  }
  const json = (await res.json()) as OllamaResponse;
  const content = json.message?.content ?? '';
  if (!content) {
    throw new CouncilProviderError('Ollama returned no content', 502);
  }
  return {
    reply: content,
    tokenUsage: {
      input: json.prompt_eval_count,
      output: json.eval_count,
    },
  };
}

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

// claude --print one-shot. Concatenate the messages into a single prompt
// (no native multi-turn here — CLI conversations need --resume against a
// session id and we're aiming for stateless per-turn for council). The
// chat history is folded into the user message as "Previously you said …".
function flattenForCli(messages: ChatMessage[]): string {
  const sys = messages.find((m) => m.role === 'system')?.content ?? '';
  const rest = messages.filter((m) => m.role !== 'system');
  const lines: string[] = [];
  if (sys) lines.push(sys, '');
  for (const m of rest) {
    const tag = m.role === 'user' ? 'USER' : 'COUNCIL';
    lines.push(`[${tag}]`);
    lines.push(m.content);
    lines.push('');
  }
  lines.push('[COUNCIL]');
  return lines.join('\n');
}

async function callClaudeCli(turn: CouncilTurn): Promise<CouncilReply> {
  const binPath = findClaudeBin();
  if (!binPath) {
    throw new CouncilProviderError(
      'The `claude` binary was not found on PATH. Install Claude Code from https://claude.com/claude-code, or use an Ollama / OpenRouter model for Council instead.',
      400,
    );
  }
  const prompt = flattenForCli(turn.messages);
  const args = ['--print', '--output-format', 'text'];
  // --model selects the user-picked CLI model (alias or full id).
  if (turn.model.modelId) {
    args.push('--model', turn.model.modelId);
  }

  return await new Promise<CouncilReply>((resolve, reject) => {
    const proc = spawn(binPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new CouncilProviderError('Claude CLI timed out after 90s', 504));
    }, 90_000);
    proc.stdout.on('data', (c: Buffer) => { stdout += c.toString('utf8'); });
    proc.stderr.on('data', (c: Buffer) => { stderr += c.toString('utf8'); });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new CouncilProviderError(`Failed to spawn claude: ${err.message}`, 500));
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(
          new CouncilProviderError(
            `claude exited with code ${String(code)}${stderr ? `: ${stderr.trim().slice(0, 400)}` : ''}`,
            502,
          ),
        );
        return;
      }
      const reply = stdout.trim();
      if (!reply) {
        reject(new CouncilProviderError('claude returned no content', 502));
        return;
      }
      resolve({ reply });
    });
    proc.stdin.end(prompt);
  });
}

export async function runCouncilTurn(turn: CouncilTurn): Promise<CouncilReply> {
  switch (turn.model.provider) {
    case 'openrouter':
      return callOpenRouter(turn);
    case 'ollama':
      return callOllama(turn);
    case 'claude_cli':
      return callClaudeCli(turn);
    case 'anthropic_api':
    case 'openai':
      throw new CouncilProviderError(
        `${turn.model.provider} adapter for council is not implemented yet`,
        501,
      );
    default: {
      const _exhaustive: never = turn.model.provider;
      void _exhaustive;
      throw new CouncilProviderError('Unknown provider', 500);
    }
  }
}
