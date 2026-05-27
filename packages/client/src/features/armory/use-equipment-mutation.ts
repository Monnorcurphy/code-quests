import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Equipment } from '@code-quests/shared';
import { api } from '../../lib/api';

interface MutationInput {
  questId: string;
  equipment: Equipment;
}

export function useEquipmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ questId, equipment }: MutationInput) =>
      api.quests.patch(questId, { equipment }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['quests'] });
    },
  });
}
