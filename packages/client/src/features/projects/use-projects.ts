import { useQuery } from '@tanstack/react-query';
import type { Project } from '@code-quests/shared';
import { api } from '../../lib/api';

export const PROJECTS_QUERY_KEY = ['projects'] as const;

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: api.projects.list,
  });
}
