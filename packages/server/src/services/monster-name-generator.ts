const ADJECTIVES = [
  'Grumbling', 'Wretched', 'Snarling', 'Cursed', 'Vile',
  'Lurking', 'Rotting', 'Haggard', 'Foul', 'Twisted',
  'Grim', 'Shambling', 'Blighted', 'Ancient', 'Dreadful',
] as const;

export function generateMonsterName(typeName: string): string {
  const idx = Math.floor(Math.random() * ADJECTIVES.length);
  return `${ADJECTIVES[idx]} ${typeName}`;
}
