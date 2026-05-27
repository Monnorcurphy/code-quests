import { Router } from 'express';
import Database from 'better-sqlite3';

type ToolRow = {
  id: string;
  name: string;
  description: string;
  invocation: string;
};

function rowToApi(row: ToolRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    invocation: row.invocation,
  };
}

export function createToolsRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const rows = db.prepare('SELECT * FROM tools ORDER BY id').all() as ToolRow[];
    res.json(rows.map(rowToApi));
  });

  return router;
}
