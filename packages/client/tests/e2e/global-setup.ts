import { execSync } from 'node:child_process';

export default async function globalSetup() {
  execSync('pnpm --filter=@code-quests/server exec tsx src/scripts/seed-dev.ts', { stdio: 'inherit' });
  execSync('pnpm --filter=@code-quests/server exec tsx src/scripts/seed-demo-quest.ts', { stdio: 'inherit' });
}
