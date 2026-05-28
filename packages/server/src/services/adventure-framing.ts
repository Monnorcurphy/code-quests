import { createHaikuAdapter } from '../agents/haiku-adapter';

function sanitizeFraming(text: string): string {
  return text
    .replace(/[\r\n]+/g, ' ')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, 200);
}

function fallbackInput(adventurerName: string, rawQuestion: string): string {
  return sanitizeFraming(`${adventurerName} pauses on the path and asks: "${rawQuestion}"`);
}

function fallbackBlocker(adventurerName: string, rawDescription: string): string {
  return sanitizeFraming(`${adventurerName} halts to seek counsel: "${rawDescription}"`);
}

export async function frameInputRequest(
  rawQuestion: string,
  adventurerName: string,
  context?: string,
): Promise<string> {
  try {
    const adapter = createHaikuAdapter();
    const contextSuffix = context ? ` Context: ${context}` : '';
    const result = await adapter.complete!({
      system:
        'You are a narrator for a medieval D&D fantasy adventure game. ' +
        'Rewrite the question as exactly one sentence of in-world narrative (max 200 characters) ' +
        'about the named adventurer using medieval D&D vocabulary. Return only the sentence.',
      prompt: `Adventurer: ${adventurerName}. Question: ${rawQuestion}.${contextSuffix}`,
      maxTokens: 80,
    });
    const sanitized = sanitizeFraming(result);
    return sanitized || fallbackInput(adventurerName, rawQuestion);
  } catch {
    return fallbackInput(adventurerName, rawQuestion);
  }
}

export async function frameUserBlocker(
  rawDescription: string,
  adventurerName: string,
): Promise<string> {
  try {
    const adapter = createHaikuAdapter();
    const result = await adapter.complete!({
      system:
        'You are a narrator for a medieval D&D fantasy adventure game. ' +
        'Rewrite the blocking situation as exactly one sentence of in-world narrative (max 200 characters) ' +
        'about the named adventurer using medieval D&D vocabulary. Return only the sentence.',
      prompt: `Adventurer: ${adventurerName}. Blocking situation: ${rawDescription}.`,
      maxTokens: 80,
    });
    const sanitized = sanitizeFraming(result);
    return sanitized || fallbackBlocker(adventurerName, rawDescription);
  } catch {
    return fallbackBlocker(adventurerName, rawDescription);
  }
}
