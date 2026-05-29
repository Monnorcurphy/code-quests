import type { AudioEvent } from './audio-events';
import { LOOPING_EVENTS } from './audio-events';

// Chiptune-style procedural music generated via OfflineAudioContext. Replaces
// the 2-second WAV stubs with a ~3:30 composition per theme so the loop
// doesn't sound like it repeats every two seconds.

const SAMPLE_RATE = 22050;
const TRACK_SECONDS = 210;
const QUARTER_PER_MEASURE = 4;

type Wave = 'square' | 'triangle' | 'sawtooth' | 'sine';

interface ThemeSpec {
  bpm: number;
  // Root MIDI note for the bass register
  bassRoot: number;
  // Each chord is a list of MIDI offsets from bassRoot
  chordProgression: number[][];
  // Pentatonic-ish intervals used to pick melody notes (semitones from root)
  scale: number[];
  // Master gain so themes balance against each other
  gain: number;
  bassWave: Wave;
  leadWave: Wave;
  hasDrums: boolean;
  feel: 'calm' | 'travel' | 'tense' | 'epic';
}

const THEMES: Partial<Record<AudioEvent, ThemeSpec>> = {
  // C major, slow, peaceful
  TOWN: {
    bpm: 88,
    bassRoot: 36, // C2
    chordProgression: [
      [0, 7, 12, 16], // C
      [-5, 2, 7, 11], // G
      [-3, 4, 9, 12], // Am
      [-7, 0, 5, 9], // F
    ],
    scale: [0, 2, 4, 7, 9], // C major pentatonic
    gain: 0.18,
    bassWave: 'triangle',
    leadWave: 'square',
    hasDrums: false,
    feel: 'calm',
  },
  // D major, upbeat, walking
  ROAD: {
    bpm: 116,
    bassRoot: 38, // D2
    chordProgression: [
      [0, 7, 12, 16], // D
      [-5, 2, 7, 11], // A
      [-3, 4, 9, 12], // Bm
      [-7, 0, 5, 9], // G
    ],
    scale: [0, 2, 4, 7, 9],
    gain: 0.18,
    bassWave: 'triangle',
    leadWave: 'square',
    hasDrums: true,
    feel: 'travel',
  },
  // E minor, urgent
  COMBAT: {
    bpm: 144,
    bassRoot: 40, // E2
    chordProgression: [
      [0, 7, 12, 15], // Em
      [-4, 3, 8, 12], // C
      [-5, 2, 7, 11], // G
      [-2, 5, 9, 12], // D
    ],
    scale: [0, 2, 3, 5, 7, 10], // E minor
    gain: 0.2,
    bassWave: 'sawtooth',
    leadWave: 'square',
    hasDrums: true,
    feel: 'tense',
  },
  // A minor, slow heavy
  BOSS: {
    bpm: 80,
    bassRoot: 33, // A1
    chordProgression: [
      [0, 7, 12, 15], // Am
      [-2, 5, 10, 14], // G
      [-4, 3, 8, 12], // F
      [-5, 2, 7, 11], // E
    ],
    scale: [0, 2, 3, 5, 7, 8, 10], // A minor
    gain: 0.22,
    bassWave: 'sawtooth',
    leadWave: 'sawtooth',
    hasDrums: true,
    feel: 'epic',
  },
};

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

interface NoteParams {
  midi: number;
  start: number;
  duration: number;
  wave: Wave;
  gain: number;
  attack?: number;
  release?: number;
}

function scheduleNote(ctx: OfflineAudioContext, dest: AudioNode, n: NoteParams): void {
  const osc = ctx.createOscillator();
  osc.type = n.wave;
  osc.frequency.value = midiToFreq(n.midi);

  const env = ctx.createGain();
  const attack = n.attack ?? 0.005;
  const release = n.release ?? 0.04;
  const sustainStart = n.start + attack;
  const sustainEnd = n.start + n.duration - release;
  const end = n.start + n.duration;
  env.gain.setValueAtTime(0, n.start);
  env.gain.linearRampToValueAtTime(n.gain, sustainStart);
  if (sustainEnd > sustainStart) {
    env.gain.setValueAtTime(n.gain, sustainEnd);
  }
  env.gain.linearRampToValueAtTime(0, end);

  osc.connect(env);
  env.connect(dest);
  osc.start(n.start);
  osc.stop(end + 0.01);
}

function scheduleSnare(
  ctx: OfflineAudioContext,
  dest: AudioNode,
  start: number,
  gain: number,
): void {
  // Short noise burst, band-passed = snare-ish
  const length = Math.floor(SAMPLE_RATE * 0.08);
  const buf = ctx.createBuffer(1, length, SAMPLE_RATE);
  const data = buf.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * 0.35));
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  bp.Q.value = 1.4;
  const env = ctx.createGain();
  env.gain.value = gain;
  src.connect(bp);
  bp.connect(env);
  env.connect(dest);
  src.start(start);
}

function scheduleKick(
  ctx: OfflineAudioContext,
  dest: AudioNode,
  start: number,
  gain: number,
): void {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(110, start);
  osc.frequency.exponentialRampToValueAtTime(40, start + 0.12);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(gain, start + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
  osc.connect(env);
  env.connect(dest);
  osc.start(start);
  osc.stop(start + 0.18);
}

// Stable pseudo-random so each render of the same theme sounds identical
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickMelodyNote(
  rng: () => number,
  spec: ThemeSpec,
  chordIdx: number,
  prevMidi: number,
): number {
  // Pick a note in the scale, biased toward the current chord tone, and
  // toward stepwise motion from the previous note.
  const chord = spec.chordProgression[chordIdx]!;
  const root = spec.bassRoot + 36; // melody is 3 octaves above bass
  const candidates: number[] = [];
  // Add all scale tones in a 1-octave window
  for (let oct = 0; oct < 2; oct++) {
    for (const interval of spec.scale) {
      candidates.push(root + oct * 12 + interval);
    }
  }
  // Add chord tones twice for emphasis
  for (const offset of chord) {
    candidates.push(spec.bassRoot + 36 + offset);
    candidates.push(spec.bassRoot + 36 + offset);
  }
  // Sort by closeness to prevMidi to bias toward stepwise motion
  candidates.sort((a, b) => Math.abs(a - prevMidi) - Math.abs(b - prevMidi));
  // Top 5 nearest, pick one weighted by closeness
  const top = candidates.slice(0, 5);
  return top[Math.floor(rng() * top.length)] ?? prevMidi;
}

function buildOfflineContextSafely(seconds: number): OfflineAudioContext {
  const length = Math.max(1, Math.floor(seconds * SAMPLE_RATE));
  // Safari uses webkitOfflineAudioContext as an older alias.
  type AnyWin = typeof globalThis & {
    OfflineAudioContext?: typeof OfflineAudioContext;
    webkitOfflineAudioContext?: typeof OfflineAudioContext;
  };
  const W = globalThis as AnyWin;
  const Ctor = W.OfflineAudioContext ?? W.webkitOfflineAudioContext;
  if (!Ctor) {
    throw new Error('OfflineAudioContext not supported');
  }
  return new Ctor(1, length, SAMPLE_RATE);
}

export async function synthesizeTheme(event: AudioEvent): Promise<AudioBuffer | null> {
  const spec = THEMES[event];
  if (!spec) return null;

  const ctx = buildOfflineContextSafely(TRACK_SECONDS);

  const master = ctx.createGain();
  master.gain.value = spec.gain;

  // Gentle low-pass to take the harsh edges off chiptune
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = spec.feel === 'epic' ? 4500 : 6500;
  lp.Q.value = 0.5;
  master.connect(lp);
  lp.connect(ctx.destination);

  const beatSec = 60 / spec.bpm;
  const measureSec = QUARTER_PER_MEASURE * beatSec;
  const totalMeasures = Math.floor(TRACK_SECONDS / measureSec);

  const rng = mulberry32(event.length * 31 + spec.bpm);

  // Per-measure scheduling
  let prevMelody = spec.bassRoot + 36 + spec.scale[0]!;
  for (let m = 0; m < totalMeasures; m++) {
    const measureStart = m * measureSec;
    const chordIdx = m % spec.chordProgression.length;
    const chord = spec.chordProgression[chordIdx]!;

    // Bass on beat 1 and 3 (root + fifth)
    for (let beat = 0; beat < QUARTER_PER_MEASURE; beat++) {
      const bStart = measureStart + beat * beatSec;
      const bassOffset = beat % 2 === 0 ? chord[0]! : (chord[1] ?? chord[0]!);
      scheduleNote(ctx, master, {
        midi: spec.bassRoot + bassOffset,
        start: bStart,
        duration: beatSec * 0.95,
        wave: spec.bassWave,
        gain: 0.5,
        attack: 0.01,
        release: 0.05,
      });
    }

    // Chord pad on beat 1 (held for full measure)
    for (const offset of chord.slice(1, 4)) {
      scheduleNote(ctx, master, {
        midi: spec.bassRoot + 12 + offset,
        start: measureStart,
        duration: measureSec * 0.98,
        wave: 'triangle',
        gain: 0.12,
        attack: 0.04,
        release: 0.3,
      });
    }

    // Melody — 4 to 8 notes per measure depending on feel
    const notesPerMeasure = spec.feel === 'calm' ? 4 : spec.feel === 'epic' ? 4 : 8;
    const noteSlot = measureSec / notesPerMeasure;
    for (let n = 0; n < notesPerMeasure; n++) {
      // Rests vary by feel
      const restProb = spec.feel === 'calm' ? 0.35 : 0.15;
      if (rng() < restProb) continue;
      const nStart = measureStart + n * noteSlot;
      const dur = noteSlot * (0.6 + rng() * 0.3);
      const midi = pickMelodyNote(rng, spec, chordIdx, prevMelody);
      prevMelody = midi;
      scheduleNote(ctx, master, {
        midi,
        start: nStart,
        duration: dur,
        wave: spec.leadWave,
        gain: 0.18 + rng() * 0.06,
        attack: 0.005,
        release: 0.08,
      });
    }

    // Drums
    if (spec.hasDrums) {
      // Kicks on beats 1 and 3
      scheduleKick(ctx, master, measureStart, 0.45);
      scheduleKick(ctx, master, measureStart + 2 * beatSec, 0.45);
      // Snare on beats 2 and 4
      scheduleSnare(ctx, master, measureStart + 1 * beatSec, 0.3);
      scheduleSnare(ctx, master, measureStart + 3 * beatSec, 0.3);
    }
  }

  return ctx.startRendering();
}

export function isProceduralTheme(event: AudioEvent): boolean {
  return LOOPING_EVENTS.has(event) && event in THEMES;
}
