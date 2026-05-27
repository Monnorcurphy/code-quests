/**
 * Validates that every PNG in assets/ is listed in assets/manifest.json
 * with a non-empty license field, and that no file is smaller than 1 KB.
 *
 * Exit 0 → all clear.
 * Exit 1 → one or more violations (details printed to stderr).
 */

import { existsSync, readdirSync, statSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(fileURLToPath(import.meta.url), '../..');
const ASSETS_DIR = join(ROOT, 'assets');
const MANIFEST_PATH = join(ASSETS_DIR, 'manifest.json');

// ── Load manifest ─────────────────────────────────────────────────────────

if (!existsSync(MANIFEST_PATH)) {
  console.error(`ERROR: assets/manifest.json not found at ${MANIFEST_PATH}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const manifestEntries = new Map(manifest.assets.map((a) => [a.file, a]));

// ── Walk assets/ for PNG files ────────────────────────────────────────────

function walkPNGs(dir, base = dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkPNGs(full, base));
    else if (entry.isFile() && entry.name.endsWith('.png')) {
      results.push(relative(base, full).replace(/\\/g, '/'));
    }
  }
  return results;
}

const actualFiles = walkPNGs(ASSETS_DIR);
let failures = 0;

// ── Check 1: every PNG is in the manifest with a license ─────────────────

for (const file of actualFiles) {
  const entry = manifestEntries.get(file);
  if (!entry) {
    console.error(`MISSING FROM MANIFEST: ${file}`);
    failures++;
    continue;
  }
  if (!entry.license || entry.license.trim() === '') {
    console.error(`MISSING LICENSE: ${file}`);
    failures++;
  }
}

// ── Check 2: every PNG is ≥ 1 KB ─────────────────────────────────────────

for (const file of actualFiles) {
  const { size } = statSync(join(ASSETS_DIR, file));
  if (size < 1024) {
    console.error(`TOO SMALL (${size} B < 1024 B): ${file}`);
    failures++;
  }
}

// ── Check 3: no orphaned manifest entries ────────────────────────────────

const actualSet = new Set(actualFiles);
for (const { file } of manifest.assets) {
  if (!actualSet.has(file)) {
    console.error(`MANIFEST ENTRY MISSING ON DISK: ${file}`);
    failures++;
  }
}

// ── Result ────────────────────────────────────────────────────────────────

if (failures > 0) {
  console.error(`\nAsset license check FAILED (${failures} violation${failures === 1 ? '' : 's'}).`);
  console.error('Add missing entries to assets/manifest.json or fix the files listed above.');
  process.exit(1);
}

console.log(`Asset license check PASSED — ${actualFiles.length} asset${actualFiles.length === 1 ? '' : 's'} verified.`);
