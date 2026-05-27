import type { Adventurer, Agent, Quest } from '@code-quests/shared';

type PreferredClass = 'champion' | 'ranger' | 'scout';

function preferredClass(quest: Quest): PreferredClass {
  const total =
    quest.equipment.skillIds.length +
    quest.equipment.toolIds.length +
    quest.equipment.mcpServerIds.length;

  if (total >= 6 || quest.acceptanceCriteria.length >= 5 || quest.description.length >= 600) {
    return 'champion';
  }
  if (total <= 1 && quest.description.length < 200) {
    return 'scout';
  }
  return 'ranger';
}

function hasSpecMatch(adventurer: Adventurer, quest: Quest): boolean {
  const haystack = [quest.description, ...quest.acceptanceCriteria].join(' ').toLowerCase();
  return adventurer.specializations.some((spec) => haystack.includes(spec.toLowerCase()));
}

function getStatInt(stats: Record<string, unknown>, key: string): number {
  const v = stats[key];
  return typeof v === 'number' ? v : 0;
}

function scoreAdventurer(adventurer: Adventurer, pClass: PreferredClass, quest: Quest): number {
  const classMatch = adventurer.class === pClass ? 1 : 0;
  const specBonus = hasSpecMatch(adventurer, quest) ? 2 : 0;
  return specBonus + classMatch;
}

export function autoMatch(
  quest: Quest,
  guild: Adventurer[],
  activeAgents: Agent[],
): Adventurer | null {
  const busyIds = new Set(
    activeAgents.filter((a) => a.endedAt === null).map((a) => a.adventurerId),
  );
  const available = guild.filter((a) => !busyIds.has(a.id));
  if (available.length === 0) return null;

  const pClass = preferredClass(quest);

  const sorted = [...available].sort((a, b) => {
    const scoreDiff = scoreAdventurer(b, pClass, quest) - scoreAdventurer(a, pClass, quest);
    if (scoreDiff !== 0) return scoreDiff;

    const aNet = getStatInt(a.stats, 'questsWon') - getStatInt(a.stats, 'questsLost');
    const bNet = getStatInt(b.stats, 'questsWon') - getStatInt(b.stats, 'questsLost');
    if (bNet !== aNet) return bNet - aNet;

    return a.createdAt.localeCompare(b.createdAt);
  });

  return sorted[0] ?? null;
}
