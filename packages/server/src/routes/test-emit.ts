import { Router } from 'express';
import { z } from 'zod';
import { AgentEventSchema } from '@code-quests/shared';
import type { AgentEvent } from '@code-quests/shared';

const BodySchema = z.object({
  questId: z.string().min(1),
  event: AgentEventSchema,
});

export function createTestEmitRouter(
  getChannel: () => { publishQuestEvent: (questId: string, event: AgentEvent) => void } | undefined,
): Router {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('createTestEmitRouter must not be called in production');
  }

  const router = Router();

  router.post('/emit-quest-event', (req, res) => {
    const bodyResult = BodySchema.safeParse(req.body ?? {});
    if (!bodyResult.success) {
      res.status(400).json({ error: 'Invalid request body', details: bodyResult.error.issues });
      return;
    }
    const { questId, event } = bodyResult.data;
    const channel = getChannel();
    if (!channel) {
      res.status(503).json({ error: 'Quest channel not available' });
      return;
    }
    channel.publishQuestEvent(questId, event);
    res.json({ ok: true });
  });

  return router;
}
