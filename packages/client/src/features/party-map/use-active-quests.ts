import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useQuestStore } from '../../stores/quest-store';
import type { Quest, QuestSceneKey, QuestStatus } from '@code-quests/shared';

export interface ActiveQuestEntry {
  quest: Quest;
  currentScene: QuestSceneKey;
  status: QuestStatus;
}

export function useActiveQuests(): { entries: ActiveQuestEntry[]; isLoading: boolean; error: unknown } {
  const { data, isLoading, error } = useQuery({
    queryKey: ['quests', 'active'],
    queryFn: api.quests.active,
    refetchInterval: 5_000,
  });

  const currentSceneByQuest = useQuestStore((s) => s.currentSceneByQuest);
  const statusByQuest = useQuestStore((s) => s.statusByQuest);

  const quests = data ?? [];

  const entries: ActiveQuestEntry[] = quests.map((quest) => ({
    quest,
    currentScene: currentSceneByQuest[quest.id] ?? quest.currentScene,
    status: statusByQuest[quest.id] ?? quest.status,
  }));

  return { entries, isLoading, error };
}
