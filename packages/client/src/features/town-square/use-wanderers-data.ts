import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Adventurer, Quest, QuestStatus } from '@code-quests/shared';
import { api } from '../../lib/api';
import { useWanderersStore, type IdleAdventurer } from '../../stores/wanderers-store';

// Statuses where an adventurer is "out on a quest" — not idle, no wanderer.
// Mirrors useGuildHallData so both scenes agree on who's busy.
const DISPATCHED_STATUSES: ReadonlySet<QuestStatus> = new Set<QuestStatus>([
  'active',
  'paused_input',
  'user_blocked',
]);

export function buildIdleList(
  adventurers: Adventurer[],
  quests: Quest[],
): IdleAdventurer[] {
  const busyIds = new Set<string>();
  for (const q of quests) {
    if (q.adventurerId && DISPATCHED_STATUSES.has(q.status)) {
      busyIds.add(q.adventurerId);
    }
  }
  return adventurers
    .filter((a) => !busyIds.has(a.id))
    .map((a) => ({ id: a.id, name: a.name }));
}

/**
 * Mounts data fetching for Town Square wanderers — idle adventurers
 * that pace around the square. Pushes the derived idle list into the
 * Zustand store so the Phaser scene can subscribe without React coupling.
 */
export function useWanderersData(enabled: boolean): void {
  const setIdleAdventurers = useWanderersStore((s) => s.setIdleAdventurers);

  const adventurersQuery = useQuery({
    queryKey: ['adventurers'],
    queryFn: api.adventurers.list,
    enabled,
    refetchInterval: enabled ? 30_000 : false,
  });

  const questsQuery = useQuery({
    queryKey: ['quests', 'all'],
    queryFn: api.quests.list,
    enabled,
    refetchInterval: enabled ? 10_000 : false,
  });

  useEffect(() => {
    if (!enabled) {
      setIdleAdventurers([]);
      return;
    }
    const adventurers = (adventurersQuery.data as Adventurer[] | undefined) ?? [];
    const quests = (questsQuery.data as Quest[] | undefined) ?? [];
    setIdleAdventurers(buildIdleList(adventurers, quests));
  }, [enabled, adventurersQuery.data, questsQuery.data, setIdleAdventurers]);
}
