import { Router } from 'express';
import Database from 'better-sqlite3';
import { resetShowcase } from '../scripts/reset-showcase';

export function createShowcaseRouter(db: Database.Database): Router {
  const router = Router();

  router.post('/reset', (_req, res) => {
    if (process.env['CODE_QUESTS_ENV'] !== 'demo') {
      res.status(403).json({ error: 'Showcase reset is only available in demo mode' });
      return;
    }

    try {
      const epicId = resetShowcase(db);
      res.json({ epicId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Reset failed';
      res.status(500).json({ error: message });
    }
  });

  return router;
}
