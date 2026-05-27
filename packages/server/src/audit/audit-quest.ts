import { SpecAuditSchema, SpecGapSchema } from '@code-quests/shared';
import type { Quest, SpecAudit, SpecGap } from '@code-quests/shared';
import type { AgentAdapter } from '../agents/adapter';

const AUDIT_SYSTEM = `You are a quest quality auditor for a software development adventure game.
Given a quest, identify gaps in its specification and return a JSON object: { "gaps": [...] }.
Each gap has: building (one of: war_room, oracle, library, tavern, armory, guild_hall), reason (string 1-500 chars), severity ("warn" or "block").
Only report gaps not already covered by the deterministic rules. Return { "gaps": [] } if no additional gaps.
Respond with ONLY valid JSON, no prose.`;

function buildDeterministicGaps(quest: Quest): SpecGap[] {
  const gaps: SpecGap[] = [];

  if (quest.description.trim().length < 20) {
    gaps.push({
      building: 'war_room',
      reason: 'Quest description is too short — flesh it out in the War Room',
      severity: 'block',
    });
  }

  const hasValidAcs =
    quest.acceptanceCriteria.length > 0 &&
    quest.acceptanceCriteria.some((ac) => ac.trim().length >= 5);
  if (!hasValidAcs) {
    gaps.push({
      building: 'oracle',
      reason: 'Acceptance criteria are missing or vague',
      severity: 'block',
    });
  }

  if (quest.edgeCases.length === 0) {
    gaps.push({
      building: 'tavern',
      reason: 'No edge cases recorded — discuss potential failure modes in the Tavern',
      severity: 'warn',
    });
  }

  const totalEquipment =
    quest.equipment.skillIds.length +
    quest.equipment.toolIds.length +
    quest.equipment.mcpServerIds.length;
  if (totalEquipment === 0) {
    gaps.push({
      building: 'armory',
      reason: 'No equipment selected — visit the Armory to pick a loadout',
      severity: 'warn',
    });
  }

  if (!quest.context.trim() && quest.description.trim().length < 80) {
    gaps.push({
      building: 'library',
      reason: 'Quest has little context — gather background in the Library',
      severity: 'warn',
    });
  }

  return gaps;
}

function buildPrompt(quest: Quest): string {
  return JSON.stringify({
    title: quest.title,
    description: quest.description,
    acceptanceCriteria: quest.acceptanceCriteria,
    edgeCases: quest.edgeCases,
    context: quest.context,
  });
}

function parseLlmGaps(raw: string): SpecGap[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as Record<string, unknown>).gaps)) {
    return [];
  }
  const rawGaps = (parsed as { gaps: unknown[] }).gaps;
  return rawGaps.flatMap((g) => {
    const result = SpecGapSchema.safeParse(g);
    return result.success ? [result.data] : [];
  });
}

export async function auditQuest(quest: Quest, adapter: AgentAdapter): Promise<SpecAudit> {
  const deterministicGaps = buildDeterministicGaps(quest);

  let llmGaps: SpecGap[] = [];
  try {
    if (adapter.complete) {
      const raw = await adapter.complete({
        system: AUDIT_SYSTEM,
        prompt: buildPrompt(quest),
        maxTokens: 1024,
      });
      llmGaps = parseLlmGaps(raw);
    }
  } catch {
    // adapter failure — deterministic gaps still surface
  }

  const allGaps = [...deterministicGaps, ...llmGaps];
  return SpecAuditSchema.parse({
    runAt: new Date().toISOString(),
    gaps: allGaps,
    bypassed: false,
  });
}
