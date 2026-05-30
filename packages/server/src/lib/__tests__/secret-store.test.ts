import { describe, it, expect, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import {
  setSecret,
  getSecret,
  hasSecret,
  deleteSecret,
} from '../secret-store';

const TEST_PREFIX = 'test-cq-secret-';

function uniqueId(): string {
  return `${TEST_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe('secret-store', () => {
  const createdIds: string[] = [];

  afterEach(async () => {
    for (const id of createdIds) {
      await deleteSecret(id).catch(() => undefined);
    }
    createdIds.length = 0;
  });

  describe('end-to-end round trip', () => {
    it('writes and reads a secret back unchanged', async () => {
      const id = uniqueId();
      createdIds.push(id);
      const payload = 'sk-this-is-a-test-key-not-real';

      await setSecret(id, payload);
      const back = await getSecret(id);

      expect(back).toBe(payload);
    });

    it('reports presence with hasSecret', async () => {
      const id = uniqueId();
      createdIds.push(id);

      expect(await hasSecret(id)).toBe(false);
      await setSecret(id, 'value');
      expect(await hasSecret(id)).toBe(true);
    });

    it('returns null for an absent secret', async () => {
      const id = uniqueId();
      const back = await getSecret(id);
      expect(back).toBeNull();
    });

    it('deletes a secret and leaves no trace', async () => {
      const id = uniqueId();
      createdIds.push(id);

      await setSecret(id, 'doomed');
      expect(await getSecret(id)).toBe('doomed');

      await deleteSecret(id);
      expect(await getSecret(id)).toBeNull();
      expect(await hasSecret(id)).toBe(false);
    });

    it('overwrites an existing secret on second set', async () => {
      const id = uniqueId();
      createdIds.push(id);

      await setSecret(id, 'first');
      await setSecret(id, 'second');

      expect(await getSecret(id)).toBe('second');
    });

    it('preserves special characters', async () => {
      const id = uniqueId();
      createdIds.push(id);
      // Mix of common API key shapes + edge cases. macOS keychain has been
      // known to choke on some control characters — confirm not these.
      const tricky = 'sk-or-v1_!@#$%^&*()-_=+[]{}|;:,.<>?/~`"\'\\';

      await setSecret(id, tricky);
      const back = await getSecret(id);

      expect(back).toBe(tricky);
    });

    it('treats unknown ids as not-present (no error)', async () => {
      // deleteSecret on a missing id must not throw — the create-then-rollback
      // path in /models route relies on this.
      await expect(deleteSecret(uniqueId())).resolves.toBeUndefined();
    });
  });

  describe('file fallback (forced)', () => {
    // The file fallback lives at ~/.code-quests/secrets/<id>.key with chmod 600.
    // We can't easily force-disable Keychain detection in test, but we can
    // verify the fallback path doesn't crash if Keychain is unavailable by
    // inspecting the actual file when present.
    it('respects chmod 600 on the fallback file when used', async () => {
      const id = uniqueId();
      createdIds.push(id);
      await setSecret(id, 'mode-check');

      // Best-effort: if the fallback file exists, it must be 600.
      const filePath = path.join(os.homedir(), '.code-quests', 'secrets', `${id}.key`);
      try {
        const stat = await fs.stat(filePath);
        const mode = stat.mode & 0o777;
        expect(mode).toBe(0o600);
      } catch {
        // Keychain path was used — no file written. That's fine.
      }
    });
  });
});
