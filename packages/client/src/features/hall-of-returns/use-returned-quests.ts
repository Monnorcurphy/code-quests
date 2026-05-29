import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { subscribe } from '../../lib/quest-socket';
import { api } from '../../lib/api';

export type ReturnedQuestsStatus = 'returned_to_town' | 'complete';

export const RETURNED_QUESTS_KEY = ['hall-of-returns', 'quests'] as const;

export function useReturnedQuests(status: ReturnedQuestsStatus) {
  const queryClient = useQueryClient();
  const queryKey = [...RETURNED_QUESTS_KEY, status] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => api.hallOfReturns.listQuests({ status }),
  });

  const items = query.data?.items;

  useEffect(() => {
    if (!items || items.length === 0) return;

    const questIds = items.map((q) => q.id);
    const unsubscribes = questIds.map((questId) =>
      subscribe(questId, (event) => {
        if (
          event.type === 'quest_returned' ||
          event.type === 'quest_retired' ||
          event.type === 'quest_reposted' ||
          event.type === 'quest_split' ||
          event.type === 'quest_feedback_added'
        ) {
          void queryClient.invalidateQueries({ queryKey: RETURNED_QUESTS_KEY });
        }
      }),
    );

    return () => unsubscribes.forEach((u) => u());
  }, [items, queryClient]);

  return query;
}
