import { spawn } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';
import type { Model } from '@code-quests/shared';
import { ADVISOR_PRESETS, type AdvisorKind, type ProposalField } from './advisor-presets';

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
  // Which advisor preset this turn belongs to. Determines which fields
  // extractProposal accepts. Defaults to 'council' for back-compat with
  // the original Council-only flow.
  kind?: AdvisorKind;
}

function allowedFields(turn: CouncilTurn): ProposalField[] {
  const kind: AdvisorKind = turn.kind ?? 'council';
  return ADVISOR_PRESETS[kind].proposalFields;
}

export interface SkillCandidate {
  name: string;
  description: string;
}

export interface ProposedEquipment {
  skillIds?: string[];
  toolIds?: string[];
  mcpServerIds?: string[];
}

export interface ProposedRefinements {
  title?: string;
  description?: string;
  acceptanceCriteria?: string[];
  edgeCases?: string[];
  context?: string;
  skillCandidates?: SkillCandidate[];
  equipment?: ProposedEquipment;
}

export interface CouncilReply {
  reply: string;
  proposedRefinements?: ProposedRefinements;
  tokenUsage?: { input?: number; output?: number };
}

const PROPOSAL_RE = /\[\[PROPOSAL\]\]\s*([\s\S]*?)\s*\[\[\/PROPOSAL\]\]/;

function sanitizeStringList(input: unknown, max: number): string[] | null {
  if (!Array.isArray(input)) return null;
  const list = input
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 500)
    .slice(0, max);
  return list.length > 0 ? list : null;
}

function sanitizeSkillCandidates(input: unknown): SkillCandidate[] | null {
  if (!Array.isArray(input)) return null;
  const candidates: SkillCandidate[] = [];
  for (const item of input) {
    if (typeof item !== 'object' || item === null) continue;
    const obj = item as Record<string, unknown>;
    const name = typeof obj['name'] === 'string' ? obj['name'].trim() : '';
    const description = typeof obj['description'] === 'string' ? obj['description'].trim() : '';
    if (name.length > 0 && name.length <= 100 && description.length > 0 && description.length <= 1000) {
      candidates.push({ name, description });
    }
    if (candidates.length >= 10) break;
  }
  return candidates.length > 0 ? candidates : null;
}

function sanitizeEquipment(input: unknown): ProposedEquipment | null {
  if (typeof input !== 'object' || input === null) return null;
  const obj = input as Record<string, unknown>;
  const out: ProposedEquipment = {};
  const fields: Array<keyof ProposedEquipment> = ['skillIds', 'toolIds', 'mcpServerIds'];
  for (const f of fields) {
    const raw = obj[f];
    if (Array.isArray(raw)) {
      const ids = raw
        .filter((x): x is string => typeof x === 'string')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length <= 200)
        .slice(0, 50);
      if (ids.length > 0) out[f] = ids;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

// Pull the structured proposal block off the end of an advisor's reply.
// Restricts to the allowed fields for the given advisor kind so a Tavern
// advisor proposing a new title gets that field silently dropped.
//
// Defaults to all council fields if no kind is passed — preserves the
// original extractProposal behaviour for back-compat with existing tests.
export function extractProposal(
  raw: string,
  allowed: ProposalField[] = ['title', 'description', 'acceptanceCriteria'],
): {
  prose: string;
  proposal?: ProposedRefinements;
} {
  const match = PROPOSAL_RE.exec(raw);
  if (!match || !match[1]) return { prose: raw.trim() };
  const prose = raw.replace(PROPOSAL_RE, '').trim();
  try {
    const parsed: unknown = JSON.parse(match[1]);
    if (typeof parsed !== 'object' || parsed === null) return { prose };
    const obj = parsed as Record<string, unknown>;
    const result: ProposedRefinements = {};
    const allowedSet = new Set(allowed);

    if (allowedSet.has('title') && typeof obj['title'] === 'string') {
      result.title = obj['title'];
    }
    if (allowedSet.has('description') && typeof obj['description'] === 'string') {
      result.description = obj['description'];
    }
    if (allowedSet.has('context') && typeof obj['context'] === 'string') {
      result.context = obj['context'];
    }
    if (allowedSet.has('acceptanceCriteria')) {
      const list = sanitizeStringList(obj['acceptanceCriteria'], 15);
      if (list) result.acceptanceCriteria = list;
    }
    if (allowedSet.has('edgeCases')) {
      const list = sanitizeStringList(obj['edgeCases'], 15);
      if (list) result.edgeCases = list;
    }
    if (allowedSet.has('skillCandidates')) {
      const candidates = sanitizeSkillCandidates(obj['skillCandidates']);
      if (candidates) result.skillCandidates = candidates;
    }
    if (allowedSet.has('equipment')) {
      const equipment = sanitizeEquipment(obj['equipment']);
      if (equipment) result.equipment = equipment;
    }

    if (Object.keys(result).length === 0) return { prose };
    return { prose, proposal: result };
  } catch {
    return { prose };
  }
}

// Back-compat alias — pre-refactor code imported COUNCIL_SYSTEM_PROMPT. Now
// it's just the council preset's voice. Each other room has its own preset.
export const COUNCIL_SYSTEM_PROMPT = ADVISOR_PRESETS.council.voice;

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
  const { prose, proposal } = extractProposal(content, allowedFields(turn));
  return {
    reply: prose,
    ...(proposal ? { proposedRefinements: proposal } : {}),
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
  const { prose, proposal } = extractProposal(content, allowedFields(turn));
  return {
    reply: prose,
    ...(proposal ? { proposedRefinements: proposal } : {}),
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
      const raw = stdout.trim();
      if (!raw) {
        reject(new CouncilProviderError('claude returned no content', 502));
        return;
      }
      const { prose, proposal } = extractProposal(raw, allowedFields(turn));
      resolve({
        reply: prose,
        ...(proposal ? { proposedRefinements: proposal } : {}),
      });
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
