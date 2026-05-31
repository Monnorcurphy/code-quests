import { Router } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { getModel } from '../db/model-repository';
import { getSecret } from '../lib/secret-store';
import { providerNeedsKey } from '@code-quests/shared';
import {
  CouncilProviderError,
  runCouncilTurn,
  type ChatMessage,
} from '../services/council';
import { ADVISOR_PRESETS, isAdvisorKind, type AdvisorKind } from '../services/advisor-presets';

const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(8000),
});

const DraftQuestSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(4000).optional(),
  acceptanceCriteria: z.array(z.string().max(500)).max(15).optional(),
  edgeCases: z.array(z.string().max(500)).max(15).optional(),
  context: z.string().max(8000).optional(),
}).default({});

// Optional catalogue for the Armory advisor — the user passes the available
// equipment ids so the advisor can pick from a real set, not hallucinated
// strings.
const EquipmentCatalogueSchema = z.object({
  skills: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  tools: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  mcpServers: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
}).optional();

const ConsultBodySchema = z.object({
  modelId: z.string().min(1),
  draftQuest: DraftQuestSchema,
  history: z.array(ChatMessageSchema).default([]),
  userMessage: z.string().min(1).max(8000),
  catalogue: EquipmentCatalogueSchema,
});

type ConsultBody = z.infer<typeof ConsultBodySchema>;

function serializeDraft(draft: ConsultBody['draftQuest'], kind: AdvisorKind): string {
  const lines: string[] = ['== Current Draft =='];
  lines.push(`Title: ${draft.title?.trim() || '(empty)'}`);
  lines.push(`Description:`);
  lines.push(draft.description?.trim() || '(empty)');

  // Only surface the fields relevant to this advisor — keeps the prompt
  // focused and avoids feeding the Tavern advisor a wall of unrelated AC text.
  const fields = new Set(ADVISOR_PRESETS[kind].proposalFields);
  if (fields.has('acceptanceCriteria') || kind === 'council' || kind === 'tavern') {
    lines.push(`Conditions of victory:`);
    const acs = draft.acceptanceCriteria ?? [];
    if (acs.length === 0) lines.push('  (none)');
    else for (const ac of acs) lines.push(`  - ${ac}`);
  }
  if (fields.has('edgeCases') || kind === 'oracle') {
    const ecs = draft.edgeCases ?? [];
    if (ecs.length > 0) {
      lines.push(`Known traps (edge cases):`);
      for (const ec of ecs) lines.push(`  - ${ec}`);
    }
  }
  if (fields.has('context') || kind === 'tavern' || kind === 'oracle') {
    const ctx = draft.context?.trim();
    if (ctx) {
      lines.push(`Background:`);
      lines.push(ctx);
    }
  }

  return lines.join('\n');
}

function serializeCatalogue(catalogue: ConsultBody['catalogue']): string {
  if (!catalogue) return '';
  const lines: string[] = ['', '== Available equipment in the Armory =='];
  if (catalogue.skills && catalogue.skills.length > 0) {
    lines.push('Skills:');
    for (const s of catalogue.skills) lines.push(`  - ${s.id} — ${s.name}`);
  }
  if (catalogue.tools && catalogue.tools.length > 0) {
    lines.push('Tools:');
    for (const t of catalogue.tools) lines.push(`  - ${t.id} — ${t.name}`);
  }
  if (catalogue.mcpServers && catalogue.mcpServers.length > 0) {
    lines.push('MCP servers:');
    for (const m of catalogue.mcpServers) lines.push(`  - ${m.id} — ${m.name}`);
  }
  if (lines.length === 2) {
    lines.push('  (empty — nothing is forged or installed)');
  }
  lines.push('');
  lines.push('When you propose equipment, use ONLY the ids listed above.');
  return lines.join('\n');
}

export function createAdvisorsRouter(db: Database.Database): Router {
  const router = Router();

  router.post('/:kind/consult', validate(ConsultBodySchema), async (req, res) => {
    const rawKind = req.params['kind'];
    if (!isAdvisorKind(rawKind)) {
      res.status(404).json({ error: `unknown advisor kind: ${String(rawKind)}` });
      return;
    }
    const kind: AdvisorKind = rawKind;
    const preset = ADVISOR_PRESETS[kind];
    const body = req.body as ConsultBody;

    const model = getModel(db, body.modelId);
    if (!model) {
      res.status(404).json({ error: 'model not found' });
      return;
    }

    let apiKey: string | undefined;
    if (providerNeedsKey(model.provider)) {
      const stored = await getSecret(model.id);
      if (!stored) {
        res.status(409).json({
          error: `Model "${model.name}" requires an API key but none is stored. Edit it in Settings to add one.`,
          code: 'NO_KEY',
        });
        return;
      }
      apiKey = stored;
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: preset.voice },
      {
        role: 'user',
        content:
          serializeDraft(body.draftQuest, kind) +
          (kind === 'armory' ? serializeCatalogue(body.catalogue) : ''),
      },
    ];
    for (const m of body.history) {
      messages.push({ role: m.role, content: m.content });
    }
    messages.push({ role: 'user', content: body.userMessage });

    try {
      const result = await runCouncilTurn({ model, apiKey, messages, kind });
      res.json({
        reply: result.reply,
        modelName: model.name,
        provider: model.provider,
        kind,
        npcName: preset.npcName,
        npcRole: preset.npcRole,
        tokenUsage: result.tokenUsage,
        ...(result.proposedRefinements
          ? { proposedRefinements: result.proposedRefinements }
          : {}),
      });
    } catch (err) {
      if (err instanceof CouncilProviderError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[advisors:${kind}] consult failed: ${msg}\n`);
      res.status(500).json({ error: `${preset.npcName} consultation failed` });
    }
  });

  return router;
}
