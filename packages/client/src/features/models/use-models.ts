import { useQuery } from '@tanstack/react-query';
import { api, type ReturnedModel } from '../../lib/api';

export const MODELS_QUERY_KEY = ['models'] as const;

export function useModels() {
  return useQuery<ReturnedModel[]>({
    queryKey: MODELS_QUERY_KEY,
    queryFn: api.models.list,
  });
}
