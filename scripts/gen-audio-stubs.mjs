/**
 * Generates minimal valid WAV placeholder files for all 8 AudioEvent tracks.
 * Each file is a synthesized sine-wave tone at a distinct frequency.
 * Safe to replace with real CC0/CC-BY chiptune tracks without any code changes —
 * the asset manifest is the single source of truth for file paths.
 *
 * Run with: node scripts/gen-audio-stubs.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(fileURLToPath(import.meta.url), '../..');
const SAMPLE_RATE = 22050;
const BITS = 16;
const CHANNELS = 1;
const BYTES_PER_SAMPLE = BITS / 8;

function buildWav(samples) {
  const dataSize = samples.length * BYTES_PER_SAMPLE;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 'ascii');

  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);  // PCM
  buf.writeUInt16LE(CHANNELS, 22);
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE, 28);
  buf.writeUInt16LE(CHANNELS * BYTES_PER_SAMPLE, 32);
  buf.writeUInt16LE(BITS, 34);

  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(clamped * 32767), 44 + i * BYTES_PER_SAMPLE);
  }

  return buf;
}

function tone(freqs, duration, volume = 0.45) {
  const n = Math.ceil(SAMPLE_RATE * duration);
  const fadeOut = Math.floor(SAMPLE_RATE * 0.08);
  return Array.from({ length: n }, (_, i) => {
    const env = i > n - fadeOut ? (n - 1 - i) / fadeOut : 1;
    const v = freqs.reduce((s, f) => s + Math.sin(2 * Math.PI * f * i / SAMPLE_RATE), 0);
    return env * volume * (v / freqs.length);
  });
}

function writeFile(relPath, samples) {
  const dest = join(ROOT, relPath);
  mkdirSync(dirname(dest), { recursive: true });
  const wav = buildWav(samples);
  writeFileSync(dest, wav);
  const kb = (wav.length / 1024).toFixed(1);
  const secs = (samples.length / SAMPLE_RATE).toFixed(1);
  console.log(`  ${relPath}  (${secs}s, ${kb} KB)`);
  return wav.length;
}

const OUT = 'packages/client/public/audio';

// AudioEvent → { file, frequencies (Hz), duration (s) }
// Different chord/frequency profiles give each track a distinct character.
const TRACKS = [
  { file: 'town-theme.wav',      freqs: [261, 329, 392], dur: 2.0 },   // C4+E4+G4 — major, calm
  { file: 'road-theme.wav',      freqs: [293, 392, 523], dur: 2.0 },   // D4+G4+C5 — upbeat travel
  { file: 'combat-theme.wav',    freqs: [220, 277, 370], dur: 2.0 },   // A3+C#4+F#4 — tense minor
  { file: 'boss-theme.wav',      freqs: [185, 220, 311], dur: 2.0 },   // F#3+A3+Eb4 — low, ominous dim
  { file: 'victory-stinger.wav', freqs: [523, 659, 784], dur: 1.2 },   // C5+E5+G5 — bright major flourish
  { file: 'quest-complete.wav',  freqs: [523, 784, 1047], dur: 1.8 },  // C5+G5+C6 — triumphant fanfare
  { file: 'quest-failed.wav',    freqs: [196, 233, 277], dur: 1.8 },   // G3+Bb3+C#4 — sombre dim
  { file: 'bell.wav',            freqs: [880, 1760], dur: 0.8 },        // A5+A6 — bell chime
];

let totalBytes = 0;
for (const { file, freqs, dur } of TRACKS) {
  totalBytes += writeFile(`${OUT}/${file}`, tone(freqs, dur));
}

console.log(`\nGenerated ${TRACKS.length} stubs  (${(totalBytes / 1024).toFixed(0)} KB total)`);
console.log('These are placeholder tones. Replace with real CC0/CC-BY tracks when available.');
