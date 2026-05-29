import type { Quest, Adventurer, FailureSummary, ScarRecord } from '@code-quests/shared';

type MintScarContext = {
  fatalMonsterId: string;
  lifetimeQuestCount: number;
};

function getStatInt(stats: Record<string, unknown>, key: string): number {
  const v = stats[key];
  return typeof v === 'number' ? v : 0;
}

export function mintScar(
  quest: Quest,
  adventurer: Adventurer,
  failureSummary: FailureSummary,
  ctx: MintScarContext,
): ScarRecord | null {
  const lifetimeQuests =
    ctx.lifetimeQuestCount > 0
      ? ctx.lifetimeQuestCount
      : getStatInt(adventurer.stats, 'questsWon') + getStatInt(adventurer.stats, 'questsLost');

  if (adventurer.scars.length === 0 && lifetimeQuests < 3) return null;

  if (failureSummary.recommendation === 'repost_with_clarification') return null;

  const notesText = failureSummary.notes ?? failureSummary.reason;
  const firstSentenceEnd = notesText.indexOf('.');
  const firstSentence =
    firstSentenceEnd >= 0 ? notesText.slice(0, firstSentenceEnd + 1) : notesText;

  return {
    questId: quest.id,
    failureSummary: firstSentence,
    monsterIdAtFatal: ctx.fatalMonsterId,
    occurredAt: new Date().toISOString(),
  };
}
