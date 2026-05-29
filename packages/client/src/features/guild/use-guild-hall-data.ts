import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Adventurer, Quest, QuestStatus } from '@code-quests/shared';
import { api } from '../../lib/api';
import {
  useGuildHallStore,
  type GuildHallAdventurer,
} from '../../stores/guild-hall-store';

const DISPATCHED_STATUSES: ReadonlySet<QuestStatus> = new Set<QuestStatus>([
  'active',
  'paused_input',
  'user_blocked',
]);

function buildRoster(adventurers: Adventurer[], quests: Quest[]): GuildHallAdventurer[] {
  const dispatchedByAdv = new Map<string, string>();
  for (const q of quests) {
    if (q.adventurerId && DISPATCHED_STATUSES.has(q.status)) {
      // First in-flight quest wins as the displayed status text.
      if (!dispatchedByAdv.has(q.adventurerId)) {
        dispatchedByAdv.set(q.adventurerId, q.title);
      }
    }
  }
  return adventurers.map((a) => {
    const title = dispatchedByAdv.get(a.id);
    return {
      id: a.id,
      name: a.name,
      class: a.class,
      status: title !== undefined ? 'on-quest' : 'idle',
      currentQuestTitle: title ?? null,
    };
  });
}

export { buildRoster };

/**
 * Mounts data fetching for the Guild Hall scene. The result is pushed into
 * the Zustand store so the Phaser scene can render adventurer sprites without
 * being coupled to React or react-query.
 */
export function useGuildHallData(enabled: boolean): void {
  const setRoster = useGuildHallStore((s) => s.setRoster);
  const clear = useGuildHallStore((s) => s.clear);

  const adventurersQuery = useQuery({
    queryKey: ['adventurers'],
    queryFn: api.adventurers.list,
    enabled,
    refetchInterval: enabled ? 10_000 : false,
  });

  const questsQuery = useQuery({
    queryKey: ['quests', 'all'],
    queryFn: api.quests.list,
    enabled,
    refetchInterval: enabled ? 5_000 : false,
  });

  useEffect(() => {
    if (!enabled) {
      clear();
      return;
    }
    const adventurers = (adventurersQuery.data ?? []) as Adventurer[];
    const quests = (questsQuery.data ?? []) as Quest[];
    setRoster(buildRoster(adventurers, quests));
  }, [enabled, adventurersQuery.data, questsQuery.data, setRoster, clear]);

  useEffect(() => {
    return () => {
      // On unmount, clear so a stale roster doesn't leak into other scenes.
      clear();
    };
  }, [clear]);
}
