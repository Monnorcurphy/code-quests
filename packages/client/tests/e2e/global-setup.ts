import { execSync } from 'node:child_process';

export default async function globalSetup() {
  execSync('pnpm --filter=@code-quests/server tsx src/scripts/seed-dev.ts', { stdio: 'inherit' });
}
