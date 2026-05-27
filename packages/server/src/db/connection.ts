import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';

const DB_DIR = path.join(os.homedir(), '.code-quests');
const DB_PATH = path.join(DB_DIR, 'db.sqlite');

export function openDb(filePath = DB_PATH): Database.Database {
  if (filePath !== ':memory:') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const db = new Database(filePath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  return db;
}

export { DB_PATH };
