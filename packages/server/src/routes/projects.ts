import { Router } from 'express';
import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { statSync } from 'fs';
import { resolve, isAbsolute } from 'path';
import { homedir } from 'os';
import { CreateProjectSchema } from '@code-quests/shared';
import { validate } from '../middleware/validate';
import {
  createProject,
  deleteProject,
  getProject,
  getProjectByPath,
  listProjects,
} from '../db/project-repository';

function expandHome(p: string): string {
  if (p === '~') return homedir();
  if (p.startsWith('~/')) return resolve(homedir(), p.slice(2));
  return p;
}

function normalizePath(p: string): string {
  return resolve(expandHome(p.trim()));
}

export function createProjectsRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(listProjects(db));
  });

  router.get('/:id', (req, res) => {
    const project = getProject(db, req.params['id']!);
    if (!project) {
      res.status(404).json({ error: 'project not found' });
      return;
    }
    res.json(project);
  });

  router.post('/', validate(CreateProjectSchema), (req, res) => {
    const body = req.body as { name: string; path: string };
    const absPath = normalizePath(body.path);

    if (!isAbsolute(absPath)) {
      res.status(400).json({ error: 'path must resolve to an absolute path' });
      return;
    }

    try {
      const stat = statSync(absPath);
      if (!stat.isDirectory()) {
        res.status(400).json({ error: 'path is not a directory' });
        return;
      }
    } catch {
      res.status(400).json({ error: 'path does not exist on this machine' });
      return;
    }

    const existing = getProjectByPath(db, absPath);
    if (existing) {
      res.status(409).json({ error: 'a project with that path already exists', project: existing });
      return;
    }

    const project = createProject(db, {
      id: randomUUID(),
      name: body.name.trim(),
      path: absPath,
    });
    res.status(201).json(project);
  });

  router.delete('/:id', (req, res) => {
    const removed = deleteProject(db, req.params['id']!);
    if (!removed) {
      res.status(404).json({ error: 'project not found' });
      return;
    }
    res.status(204).end();
  });

  return router;
}
