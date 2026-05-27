import { Router } from 'express';
import Database from 'better-sqlite3';

type MCPServerRow = {
  id: string;
  name: string;
  config_json: string;
};

function rowToApi(row: MCPServerRow) {
  return {
    id: row.id,
    name: row.name,
    config: JSON.parse(row.config_json) as Record<string, unknown>,
  };
}

export function createMCPServersRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const rows = db.prepare('SELECT * FROM mcp_servers ORDER BY id').all() as MCPServerRow[];
    res.json(rows.map(rowToApi));
  });

  return router;
}
