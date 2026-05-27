import { describe, it, expect } from 'vitest';
import type { Quest, Adventurer } from './index';

describe('Quest', () => {
  it('accepts a valid quest object', () => {
    const quest: Quest = { id: '1', name: 'Slay the Dragon', status: 'active' };
    expect(quest.status).toBe('active');
  });
});

describe('Adventurer', () => {
  it('accepts a valid adventurer object', () => {
    const adventurer: Adventurer = { id: '1', name: 'Aria', level: 5 };
    expect(adventurer.level).toBe(5);
  });
});
