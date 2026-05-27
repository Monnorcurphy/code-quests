import express from 'express';
import { openDb } from './db/connection';
import { runMigrations } from './db/migrator';
import { createAdventurersRouter } from './routes/adventurers';
import { createEpicsRouter } from './routes/epics';
import { createQuestsRouter } from './routes/quests';
import { errorHandler } from './middleware/errors';

const db = openDb();
runMigrations(db);

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/adventurers', createAdventurersRouter(db));
app.use('/epics', createEpicsRouter(db));
app.use('/quests', createQuestsRouter(db));

app.use(errorHandler);

export { app };

if (require.main === module) {
  const port = Number(process.env.PORT) || 4001;
  app.listen(port, () => {
    process.stdout.write(`server listening on :${port}\n`);
  });
}
