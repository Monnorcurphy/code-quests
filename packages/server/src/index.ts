import express from 'express';
import Database from 'better-sqlite3';
import { openDb } from './db/connection';
import { runMigrations } from './db/migrator';
import { createAdventurersRouter } from './routes/adventurers';
import { createEpicsRouter } from './routes/epics';
import { createQuestsRouter } from './routes/quests';
import { createSkillsRouter } from './routes/skills';
import { createToolsRouter } from './routes/tools';
import { createMCPServersRouter } from './routes/mcp-servers';
import { errorHandler } from './middleware/errors';

export function createApp(db: Database.Database) {
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/adventurers', createAdventurersRouter(db));
  app.use('/epics', createEpicsRouter(db));
  app.use('/quests', createQuestsRouter(db));
  app.use('/skills', createSkillsRouter(db));
  app.use('/tools', createToolsRouter(db));
  app.use('/mcp-servers', createMCPServersRouter(db));
  app.use(errorHandler);
  return app;
}

if (require.main === module) {
  const db = openDb();
  runMigrations(db);
  const app = createApp(db);
  const port = Number(process.env.PORT) || 4001;
  app.listen(port, () => {
    process.stdout.write(`server listening on :${port}\n`);
  });
}
