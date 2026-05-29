import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { subscribe } from '../../lib/quest-socket';
import { api } from '../../lib/api';

export const postMortemKey = (questId: string) => ['post-mortem', questId] as const;

export function usePostMortem(questId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: postMortemKey(questId),
    queryFn: () => api.hallOfReturns.getPostMortem(questId),
    enabled: !!questId,
  });

  useEffect(() => {
    if (!questId) return;
    return subscribe(questId, (event) => {
      if (event.type === 'quest_feedback_added') {
        void queryClient.invalidateQueries({ queryKey: postMortemKey(questId) });
      }
    });
  }, [questId, queryClient]);

  return query;
}
