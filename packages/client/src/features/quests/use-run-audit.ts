import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export function useRunAudit(questId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (!questId) throw new Error('No quest selected');
      return api.quests.audit(questId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['quests'] });
      if (questId) {
        void queryClient.invalidateQueries({ queryKey: ['quest', questId] });
      }
    },
  });
}
