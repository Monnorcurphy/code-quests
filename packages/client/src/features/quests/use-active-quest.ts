import { useEffect, useReducer } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { subscribe } from '../../lib/quest-socket';
import { api } from '../../lib/api';
import type { AgentEvent, Quest } from '@code-quests/shared';

type State = { events: AgentEvent[] };
type Action = { type: 'append'; event: AgentEvent } | { type: 'reset' };

function reducer(state: State, action: Action): State {
  if (action.type === 'reset') return { events: [] };
  return { events: [...state.events, action.event] };
}

export function useActiveQuest(questId: string) {
  const queryClient = useQueryClient();

  const { data: questData, isLoading, error } = useQuery({
    queryKey: ['quest', questId],
    queryFn: () => api.quests.get(questId),
  });
  const quest = questData as Quest | undefined;

  const [{ events }, dispatch] = useReducer(reducer, { events: [] });

  useEffect(() => {
    dispatch({ type: 'reset' });
    return subscribe(questId, (event) => {
      dispatch({ type: 'append', event });
      if (
        event.type === 'completed' ||
        event.type === 'failed' ||
        event.type === 'status_change'
      ) {
        void queryClient.invalidateQueries({ queryKey: ['quest', questId] });
        void queryClient.invalidateQueries({ queryKey: ['quests'] });
      }
    });
  }, [questId, queryClient]);

  return { quest, isLoading, error, events };
}
