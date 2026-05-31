import { Router } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { getModel } from '../db/model-repository';
import { getSecret } from '../lib/secret-store';
import { providerNeedsKey } from '@code-quests/shared';
import {
  COUNCIL_SYSTEM_PROMPT,
  CouncilProviderError,
  runCouncilTurn,
  type ChatMessage,
} from '../services/council';

const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(8000),
});

const DraftQuestSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(4000).optional(),
  acceptanceCriteria: z.array(z.string().max(500)).max(15).optional(),
}).default({});

const ConsultBodySchema = z.object({
  modelId: z.string().min(1),
  draftQuest: DraftQuestSchema,
  history: z.array(ChatMessageSchema).default([]),
  userMessage: z.string().min(1).max(8000),
});

type ConsultBody = z.infer<typeof ConsultBodySchema>;

// Serialize the draft into a stable opening user turn so the council
// always sees the latest state of the spec.
function serializeDraft(draft: ConsultBody['draftQuest']): string {
  const lines: string[] = ['== Current Draft =='];
  lines.push(`Title: ${draft.title?.trim() || '(empty)'}`);
  lines.push(`Description:`);
  lines.push(draft.description?.trim() || '(empty)');
  lines.push(`Acceptance Criteria:`);
  const acs = draft.acceptanceCriteria ?? [];
  if (acs.length === 0) {
    lines.push('  (none)');
  } else {
    for (const ac of acs) {
      lines.push(`  - ${ac}`);
    }
  }
  return lines.join('\n');
}

export function createCouncilRouter(db: Database.Database): Router {
  const router = Router();

  router.post('/consult', validate(ConsultBodySchema), async (req, res) => {
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

    // Build the message list: system, draft as first user turn, then full
    // history alternating user/assistant, then the new user message.
    const messages: ChatMessage[] = [
      { role: 'system', content: COUNCIL_SYSTEM_PROMPT },
      { role: 'user', content: serializeDraft(body.draftQuest) },
    ];
    for (const m of body.history) {
      messages.push({ role: m.role, content: m.content });
    }
    messages.push({ role: 'user', content: body.userMessage });

    try {
      const result = await runCouncilTurn({ model, apiKey, messages });
      res.json({
        reply: result.reply,
        modelName: model.name,
        provider: model.provider,
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
      process.stderr.write(`[council] consult failed: ${msg}\n`);
      res.status(500).json({ error: 'Council consultation failed' });
    }
  });

  return router;
}
