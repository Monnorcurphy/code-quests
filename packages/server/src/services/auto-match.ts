import type { Adventurer, Agent, Quest, Monster, MonsterType, ScarRecord } from '@code-quests/shared';

type PreferredClass = 'champion' | 'ranger' | 'scout';

export interface AutoMatchOptions {
  monsters?: Monster[];
  monsterTypes?: MonsterType[];
  logger?: (entry: Record<string, unknown>) => void;
}

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

function predictDominantMonsterTypeId(quest: Quest, monsterTypes: MonsterType[]): string | null {
  const text = `${quest.title} ${quest.description} ${quest.acceptanceCriteria.join(' ')}`;
  for (const mt of monsterTypes) {
    try {
      if (new RegExp(mt.failureSignature, 'i').test(text)) return mt.id;
    } catch {
      // skip invalid regex
    }
  }
  return null;
}

function tokenOverlapRatio(a: string, b: string): number {
  const wordsA = new Set<string>(a.toLowerCase().match(/\w+/g) ?? []);
  if (wordsA.size === 0) return 0;
  const wordsB = new Set<string>(b.toLowerCase().match(/\w+/g) ?? []);
  let count = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) count++;
  }
  return count / wordsA.size;
}

function scarMatchesQuest(
  scar: ScarRecord,
  questText: string,
  dominantTypeId: string | null,
  monsters: Monster[],
): boolean {
  if (dominantTypeId !== null) {
    const monster = monsters.find((m) => m.id === scar.monsterIdAtFatal);
    if (monster !== undefined && monster.typeId === dominantTypeId) return true;
  }
  return tokenOverlapRatio(scar.failureSummary, questText) >= 0.5;
}

function computeScarPenalty(adventurer: Adventurer, quest: Quest, opts: AutoMatchOptions): number {
  if (adventurer.scars.length === 0) return 0;
  const { monsters = [], monsterTypes = [] } = opts;
  const dominantTypeId = predictDominantMonsterTypeId(quest, monsterTypes);
  const questText = `${quest.title} ${quest.description}`;
  let matchCount = 0;
  for (const scar of adventurer.scars) {
    if (scarMatchesQuest(scar, questText, dominantTypeId, monsters)) matchCount++;
  }
  return -Math.min(matchCount * 15, 30);
}

export function autoMatch(
  quest: Quest,
  guild: Adventurer[],
  activeAgents: Agent[],
  options: AutoMatchOptions = {},
): Adventurer | null {
  const busyIds = new Set(
    activeAgents.filter((a) => a.endedAt === null).map((a) => a.adventurerId),
  );
  const available = guild.filter((a) => !busyIds.has(a.id));
  if (available.length === 0) return null;

  const pClass = preferredClass(quest);

  const penaltyMap = new Map<string, number>();
  for (const adventurer of available) {
    const penalty = computeScarPenalty(adventurer, quest, options);
    penaltyMap.set(adventurer.id, penalty);
    if (penalty !== 0) {
      options.logger?.({ adventurerId: adventurer.id, scarPenalty: penalty });
    }
  }

  const sorted = [...available].sort((a, b) => {
    const scoreA = scoreAdventurer(a, pClass, quest) + (penaltyMap.get(a.id) ?? 0);
    const scoreB = scoreAdventurer(b, pClass, quest) + (penaltyMap.get(b.id) ?? 0);
    const scoreDiff = scoreB - scoreA;
    if (scoreDiff !== 0) return scoreDiff;

    const aNet = getStatInt(a.stats, 'questsWon') - getStatInt(a.stats, 'questsLost');
    const bNet = getStatInt(b.stats, 'questsWon') - getStatInt(b.stats, 'questsLost');
    if (bNet !== aNet) return bNet - aNet;

    return a.createdAt.localeCompare(b.createdAt);
  });

  return sorted[0] ?? null;
}
