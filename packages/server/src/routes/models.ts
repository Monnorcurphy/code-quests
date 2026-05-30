import { Router } from 'express';
import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { CreateModelSchema, providerNeedsKey } from '@code-quests/shared';
import { validate } from '../middleware/validate';
import {
  createModel,
  deleteModel,
  getModel,
  listModels,
} from '../db/model-repository';
import { deleteSecret, hasSecret, setSecret } from '../lib/secret-store';

// API surface for the model registry. The actual API key never round-trips
// from the server — only the boolean `hasKey` is reported.
function withKeyFlag<T extends { id: string }>(model: T, hasKey: boolean): T & { hasKey: boolean } {
  return { ...model, hasKey };
}

export function createModelsRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const models = listModels(db);
    const enriched = await Promise.all(
      models.map(async (m) => withKeyFlag(m, await hasSecret(m.id))),
    );
    res.json(enriched);
  });

  router.get('/:id', async (req, res) => {
    const model = getModel(db, req.params['id']!);
    if (!model) {
      res.status(404).json({ error: 'model not found' });
      return;
    }
    const hasKey = await hasSecret(model.id);
    res.json(withKeyFlag(model, hasKey));
  });

  router.post('/', validate(CreateModelSchema), async (req, res) => {
    const body = req.body as { name: string; provider: 'claude_cli' | 'openrouter' | 'ollama' | 'anthropic_api' | 'openai'; modelId: string; apiKey?: string; config: Record<string, unknown> };

    if (providerNeedsKey(body.provider) && !body.apiKey) {
      res.status(400).json({
        error: `${body.provider} requires an API key`,
        field: 'apiKey',
      });
      return;
    }

    const id = randomUUID();
    const model = createModel(db, {
      id,
      name: body.name.trim(),
      provider: body.provider,
      modelId: body.modelId.trim(),
      config: body.config ?? {},
    });

    if (body.apiKey) {
      try {
        await setSecret(id, body.apiKey);
      } catch (err) {
        // Roll back the model row so we don't leave a key-less stub.
        deleteModel(db, id);
        const msg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: `failed to save API key: ${msg}` });
        return;
      }
    }

    const hasKey = await hasSecret(id);
    res.status(201).json(withKeyFlag(model, hasKey));
  });

  router.delete('/:id', async (req, res) => {
    const id = req.params['id']!;
    const removed = deleteModel(db, id);
    if (!removed) {
      res.status(404).json({ error: 'model not found' });
      return;
    }
    await deleteSecret(id);
    res.status(204).end();
  });

  return router;
}
