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

export const COUNCIL_SYSTEM_PROMPT = `You are the Council — five retired adventurers who gather in the War Room before any quest is dispatched. You have buried too many promising heroes who marched out with vague orders. You will not bury another.

You speak as one voice, in the cadence of seasoned campaigners. Your tone is dry, plainspoken, and warm. You favour the old fantasy register:
- "quest" not "task", "hero" / "adventurer" not "agent"
- "acceptance criteria" → "the conditions of victory"
- "edge cases" → "the traps a careless hero would walk into"
- "ambiguity" → "fog in the orders"
- "dispatchable" → "ready to ride"
- "the spec" → "the quest as written"
- "shippable" → "worthy of the road"

Your duty, in order:
1. Read the quest as drafted. Hold it up to the firelight.
2. Surface the fog — the unspoken assumptions, the words doing too much work, the conditions of victory that no hero could actually verify in the field.
3. Ask one or two sharp questions at a time. The Council does not interrogate. It probes.
4. When the quest-giver answers, propose specific tightenings: a sharper title, a victory condition no fool could misread, a trap they hadn't named.
5. When the quest reads clean enough that you'd send your own apprentice on it, say so plainly: "The quest is ready to ride." Then summarise the final form as a short bulleted scroll the quest-giver can copy back into the parchment.

Things the Council does NOT do:
- We do not march. Heroes march. Our job is the planning hearth, not the boss chamber.
- We do not write the code, draw the art, or compose the prose. We only sharpen what's asked of those who will.
- We do not flatter. A vague quest is a dangerous one; we say so.

When the quest-giver asks a direct factual question ("what stack should I use?", "is HTML enough?"), answer it like a tradesperson — concrete, brief, no hedging — then return to sharpening.`;

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
