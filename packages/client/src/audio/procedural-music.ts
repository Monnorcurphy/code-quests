import type { AudioEvent } from './audio-events';
import { LOOPING_EVENTS } from './audio-events';

// Hand-composed chiptune. Each theme has actual melody data (note sequences,
// not random scale notes), arranged in song form (intro → A → A' → B → A →
// outro) and repeated to fill the requested duration. Lead voice + counter
// voice + walking bass + drums (for action themes) sit in distinct registers
// so it sounds like a song, not noodling.

const SAMPLE_RATE = 22050;
const SINGLE_TRACK_SECONDS = 300;
const VARIATION_SECONDS = 300;

type Wave = 'square' | 'triangle' | 'sawtooth' | 'sine';

// Note format: [semitone offset from songRoot, duration in beats].
// Use REST for silence. Negative offsets go below the root.
type Note = [pitch: number, duration: number];
const REST: Note = [-9999, 1];
const isRest = (n: Note) => n[0] === REST[0];

interface ThemeSpec {
  bpm: number;
  // Root MIDI note for the song's tonic (the "key" the song is in).
  // Lead melody plays one octave above this; bass plays one octave below.
  songRoot: number;
  // Lead melody sections — composed phrases. Each section ideally totals 8 beats (2 bars 4/4).
  leadA: Note[];
  leadB: Note[];
  // Counter-melody / harmony line, sits an octave below lead. Optional.
  counterA?: Note[];
  counterB?: Note[];
  // Bass line — chord roots with walking passing tones. Should also be 8 beats per section.
  bassA: Note[];
  bassB: Note[];
  // Song form pattern, each letter consumes one 8-beat section.
  // Example: 'AABABAB' → A A B A B A B → 56 beats per song cycle.
  songForm: string;
  // Total composition length in seconds. Song form cycles repeat until this is filled.
  durationSec: number;
  // Voices.
  bassWave: Wave;
  leadWave: Wave;
  counterWave: Wave;
  hasDrums: boolean;
  // Master gain so themes balance against each other.
  gain: number;
  subTheme: string;
}

// ============================================================================
// COMPOSITIONS
// All pitch numbers are semitones from songRoot.
// Common intervals: 0=root, 2=2nd, 4=3rd, 5=4th, 7=5th, 9=6th, 11=7th, 12=octave
// Minor 3rd = 3, minor 6th = 8, minor 7th = 10
// ============================================================================

// ------------ TOWN (peaceful village) — C major, 88 BPM ---------------------
const TOWN_LEAD_A: Note[] = [
  // bar 1: "Welcome home" — ascending arpeggio resolving on the 5th
  [0, 0.5], [4, 0.5], [7, 0.5], [12, 0.5], [9, 0.5], [7, 0.5], [4, 1],
  // bar 2: answer phrase descending
  [7, 0.5], [4, 0.5], [2, 0.5], [0, 0.5], [-1, 0.5], [-3, 0.5], [0, 1],
];
const TOWN_LEAD_B: Note[] = [
  // bar 1: bridge — bittersweet, goes to 6th and 4th
  [9, 1], [7, 0.5], [4, 0.5], [5, 0.5], [4, 0.5], [2, 1],
  // bar 2: contrast — leaps to high octave then walks down
  [12, 0.5], [11, 0.5], [9, 0.5], [7, 0.5], [5, 0.5], [4, 0.5], [2, 0.5], [0, 0.5],
];
const TOWN_COUNTER_A: Note[] = [
  // Harmony 3rds below lead
  [-3, 1], [4, 1], [2, 1], [0, 1], [-3, 2], [0, 2],
];
const TOWN_COUNTER_B: Note[] = [
  [5, 2], [2, 2], [7, 2], [-3, 2],
];
const TOWN_BASS_A: Note[] = [
  // I - V - vi - IV (C - G - Am - F)
  [0, 2], [7, 2], [9, 2], [5, 2],
];
const TOWN_BASS_B: Note[] = [
  // vi - IV - I - V (Am - F - C - G)
  [9, 2], [5, 2], [0, 2], [7, 2],
];

// ------------ ROAD: Forest Stroll — D major, 116 BPM ------------------------
const ROAD1_LEAD_A: Note[] = [
  // bar 1: stepping motif
  [0, 0.5], [2, 0.5], [4, 0.5], [7, 0.5], [4, 0.5], [2, 0.5], [0, 1],
  // bar 2: skip and resolve
  [7, 0.5], [9, 0.5], [11, 0.5], [12, 0.5], [9, 0.5], [7, 0.5], [4, 1],
];
const ROAD1_LEAD_B: Note[] = [
  // bar 1: contrasting jumpy motif
  [12, 0.5], [9, 0.5], [12, 0.5], [9, 0.5], [11, 0.5], [9, 0.5], [7, 0.5], [4, 0.5],
  // bar 2: sequence down
  [9, 0.5], [7, 0.5], [4, 0.5], [2, 0.5], [4, 0.5], [2, 0.5], [0, 1],
];
const ROAD1_BASS_A: Note[] = [
  // I - V - vi - IV walking (root, 5th, root, 5th)
  [0, 1], [7, 1], [7, 1], [4, 1], [9, 1], [4, 1], [5, 1], [0, 1],
];
const ROAD1_BASS_B: Note[] = [
  [4, 1], [0, 1], [5, 1], [0, 1], [0, 1], [7, 1], [7, 1], [-5, 1],
];

// ------------ ROAD: Mountain Pass — G major, 96 BPM, regal ------------------
const ROAD2_LEAD_A: Note[] = [
  // bar 1: fanfare-like leaps
  [0, 1], [4, 0.5], [7, 0.5], [12, 1], [7, 0.5], [4, 0.5],
  // bar 2: declamatory
  [7, 0.5], [9, 0.5], [11, 1], [9, 0.5], [7, 0.5], [4, 1],
];
const ROAD2_LEAD_B: Note[] = [
  // bar 1: dotted rhythm walking up
  [0, 0.75], [2, 0.25], [4, 0.75], [5, 0.25], [7, 1], [4, 1],
  // bar 2: descending sequence
  [11, 0.5], [9, 0.5], [7, 0.5], [5, 0.5], [4, 0.5], [2, 0.5], [0, 1],
];
const ROAD2_BASS_A: Note[] = [
  [0, 2], [9, 2], [5, 2], [0, 2],
];
const ROAD2_BASS_B: Note[] = [
  [4, 2], [5, 2], [0, 2], [7, 2],
];

// ------------ ROAD: River Crossing — E minor, 104 BPM -----------------------
const ROAD3_LEAD_A: Note[] = [
  [0, 0.5], [3, 0.5], [7, 0.5], [10, 0.5], [12, 0.5], [10, 0.5], [7, 1],
  [10, 0.5], [12, 0.5], [15, 0.5], [12, 0.5], [10, 0.5], [7, 0.5], [3, 1],
];
const ROAD3_LEAD_B: Note[] = [
  [15, 1], [12, 0.5], [10, 0.5], [12, 0.5], [10, 0.5], [7, 1],
  [10, 0.5], [7, 0.5], [3, 0.5], [0, 0.5], [3, 0.5], [7, 0.5], [3, 1],
];
const ROAD3_BASS_A: Note[] = [
  [0, 2], [-2, 2], [-5, 2], [-7, 2],
];
const ROAD3_BASS_B: Note[] = [
  [-5, 2], [0, 2], [3, 2], [-7, 2],
];

// ------------ ROAD: Twilight Ride — B minor, 88 BPM, contemplative ----------
const ROAD4_LEAD_A: Note[] = [
  // slow, expressive
  [0, 1], [3, 1], [7, 1], [3, 1],
  [10, 1], [7, 1], [5, 0.5], [3, 0.5], [0, 1],
];
const ROAD4_LEAD_B: Note[] = [
  [12, 1], [10, 1], [7, 1], [3, 1],
  [5, 0.5], [3, 0.5], [0, 0.5], [-2, 0.5], [0, 2],
];
const ROAD4_BASS_A: Note[] = [
  [0, 2], [-5, 2], [-7, 2], [-2, 2],
];
const ROAD4_BASS_B: Note[] = [
  [3, 2], [0, 2], [-7, 2], [-5, 2],
];

// ------------ ROAD: Open Plains — A major, 124 BPM, triumphant --------------
const ROAD5_LEAD_A: Note[] = [
  // ascending fanfare
  [0, 0.25], [4, 0.25], [7, 0.5], [12, 0.5], [9, 0.5], [7, 0.5], [4, 0.5], [7, 1],
  [4, 0.25], [7, 0.25], [9, 0.5], [12, 0.5], [9, 0.5], [7, 0.5], [4, 0.5], [0, 1],
];
const ROAD5_LEAD_B: Note[] = [
  [12, 0.5], [11, 0.5], [9, 0.5], [7, 0.5], [12, 0.5], [11, 0.5], [9, 0.5], [7, 0.5],
  [16, 1], [12, 1], [9, 1], [7, 1],
];
const ROAD5_BASS_A: Note[] = [
  [0, 1], [4, 1], [7, 1], [4, 1], [0, 1], [-5, 1], [-3, 1], [0, 1],
];
const ROAD5_BASS_B: Note[] = [
  [7, 1], [4, 1], [9, 1], [4, 1], [0, 1], [5, 1], [7, 1], [-5, 1],
];

// ------------ ROAD: Approaching Danger — F# minor, 108 BPM, tense ----------
const ROAD6_LEAD_A: Note[] = [
  // chromatic creeping motif
  [0, 0.5], [3, 0.5], [5, 0.5], [3, 0.5], [0, 0.5], [-2, 0.5], [0, 1],
  [7, 0.5], [10, 0.5], [12, 0.5], [10, 0.5], [7, 0.5], [3, 0.5], [0, 1],
];
const ROAD6_LEAD_B: Note[] = [
  [12, 0.5], [11, 0.5], [10, 0.5], [12, 0.5], [10, 0.5], [9, 0.5], [7, 1],
  [10, 0.5], [9, 0.5], [7, 0.5], [5, 0.5], [3, 0.5], [0, 0.5], [-2, 1],
];
const ROAD6_BASS_A: Note[] = [
  [0, 2], [3, 2], [-2, 2], [-5, 2],
];
const ROAD6_BASS_B: Note[] = [
  [-5, 2], [-7, 2], [0, 2], [-2, 2],
];

// ------------ COMBAT: Initial Skirmish — E minor, 144 BPM -------------------
const C1_LEAD_A: Note[] = [
  // driving riff
  [0, 0.25], [3, 0.25], [7, 0.5], [3, 0.25], [0, 0.25], [7, 0.5], [3, 0.5], [0, 0.5],
  [0, 0.25], [3, 0.25], [7, 0.5], [10, 0.25], [12, 0.25], [15, 0.5], [12, 0.5], [7, 0.5],
];
const C1_LEAD_B: Note[] = [
  [15, 0.5], [14, 0.5], [12, 0.5], [10, 0.5], [12, 0.5], [10, 0.5], [7, 0.5], [3, 0.5],
  [7, 0.5], [10, 0.5], [12, 0.5], [10, 0.5], [7, 0.5], [3, 0.5], [0, 1],
];
const C1_BASS_A: Note[] = [
  // syncopated minor riff
  [0, 0.5], [0, 0.5], [-5, 0.5], [-2, 0.5], [-3, 0.5], [-3, 0.5], [-5, 1],
  [0, 0.5], [0, 0.5], [3, 0.5], [-2, 0.5], [-5, 0.5], [-2, 0.5], [0, 1],
];
const C1_BASS_B: Note[] = [
  [-5, 1], [-2, 1], [0, 1], [-3, 1], [-5, 1], [-7, 1], [0, 1], [-5, 1],
];

// ------------ COMBAT: Heroic Counter — C major, 136 BPM ---------------------
const C2_LEAD_A: Note[] = [
  // rising heroic motif
  [0, 0.5], [4, 0.5], [7, 0.5], [12, 0.5], [9, 0.5], [12, 0.5], [7, 1],
  [4, 0.5], [7, 0.5], [9, 0.5], [12, 0.5], [11, 0.5], [9, 0.5], [4, 1],
];
const C2_LEAD_B: Note[] = [
  [16, 0.5], [14, 0.5], [12, 0.5], [11, 0.5], [9, 0.5], [7, 0.5], [4, 0.5], [2, 0.5],
  [4, 0.5], [7, 0.5], [12, 1], [7, 0.5], [4, 0.5], [0, 1],
];
const C2_BASS_A: Note[] = [
  [0, 1], [4, 1], [7, 1], [-5, 1], [9, 1], [5, 1], [0, 1], [7, 1],
];
const C2_BASS_B: Note[] = [
  [5, 1], [0, 1], [-7, 1], [0, 1], [4, 1], [7, 1], [-5, 1], [0, 1],
];

// ------------ COMBAT: Desperate Struggle — D minor, 152 BPM -----------------
const C3_LEAD_A: Note[] = [
  [0, 0.25], [3, 0.25], [7, 0.25], [10, 0.25], [12, 0.5], [10, 0.5], [7, 0.5], [3, 0.5],
  [0, 0.25], [3, 0.25], [7, 0.25], [10, 0.25], [15, 0.5], [12, 0.5], [10, 1],
];
const C3_LEAD_B: Note[] = [
  [17, 0.5], [15, 0.5], [12, 0.5], [10, 0.5], [12, 0.5], [10, 0.5], [7, 0.5], [3, 0.5],
  [10, 0.25], [7, 0.25], [3, 0.25], [0, 0.25], [-2, 0.5], [-5, 0.5], [0, 1],
];
const C3_BASS_A: Note[] = [
  [0, 1], [0, 1], [-2, 1], [-2, 1], [-5, 1], [-5, 1], [3, 1], [-2, 1],
];
const C3_BASS_B: Note[] = [
  [-5, 1], [-7, 1], [0, 1], [3, 1], [-2, 1], [-5, 1], [0, 1], [0, 1],
];

// ------------ COMBAT: Battle of Attrition — B minor, 132 BPM ----------------
const C4_LEAD_A: Note[] = [
  [0, 0.5], [3, 0.5], [0, 0.5], [3, 0.5], [7, 1], [5, 0.5], [3, 0.5],
  [0, 0.5], [3, 0.5], [7, 0.5], [10, 0.5], [12, 1], [10, 1],
];
const C4_LEAD_B: Note[] = [
  [10, 0.5], [7, 0.5], [10, 0.5], [7, 0.5], [5, 0.5], [3, 0.5], [0, 1],
  [3, 0.5], [5, 0.5], [7, 0.5], [10, 0.5], [12, 1], [7, 1],
];
const C4_BASS_A: Note[] = [
  [0, 1], [0, 1], [-5, 1], [-5, 1], [-2, 1], [-2, 1], [-3, 1], [-7, 1],
];
const C4_BASS_B: Note[] = [
  [-7, 1], [-5, 1], [-2, 1], [-3, 1], [0, 1], [3, 1], [7, 1], [0, 1],
];

// ------------ COMBAT: Last Stand — G major, 148 BPM, triumphant push --------
const C5_LEAD_A: Note[] = [
  [0, 0.5], [7, 0.5], [4, 0.5], [7, 0.5], [12, 0.5], [9, 0.5], [7, 1],
  [4, 0.5], [7, 0.5], [9, 0.5], [12, 0.5], [11, 0.5], [9, 0.5], [7, 1],
];
const C5_LEAD_B: Note[] = [
  [12, 0.5], [14, 0.5], [16, 0.5], [14, 0.5], [12, 0.5], [11, 0.5], [9, 0.5], [7, 0.5],
  [4, 0.5], [7, 0.5], [11, 0.5], [14, 0.5], [16, 1], [12, 1],
];
const C5_BASS_A: Note[] = [
  [0, 1], [4, 1], [-5, 1], [0, 1], [5, 1], [0, 1], [-7, 1], [0, 1],
];
const C5_BASS_B: Note[] = [
  [4, 1], [-5, 1], [9, 1], [5, 1], [0, 1], [-5, 1], [4, 1], [-7, 1],
];

// ------------ COMBAT: Mortal Danger — A minor, 140 BPM, dark ----------------
const C6_LEAD_A: Note[] = [
  [0, 0.25], [0, 0.25], [3, 0.5], [0, 0.5], [-2, 0.5], [0, 1],
  [3, 0.5], [7, 0.5], [10, 0.5], [7, 0.5], [3, 0.5], [0, 1.5],
];
const C6_LEAD_B: Note[] = [
  [12, 0.5], [11, 0.5], [10, 0.5], [12, 0.5], [10, 0.5], [7, 0.5], [3, 1],
  [10, 0.5], [12, 0.5], [10, 0.5], [7, 0.5], [3, 0.5], [0, 0.5], [-2, 1],
];
const C6_BASS_A: Note[] = [
  [0, 1], [0, 1], [-4, 1], [-4, 1], [-5, 1], [-5, 1], [-7, 1], [-7, 1],
];
const C6_BASS_B: Note[] = [
  [-5, 1], [-7, 1], [0, 1], [-4, 1], [-2, 1], [-5, 1], [0, 1], [-7, 1],
];

// ------------ BOSS: heavy A minor, 80 BPM, epic -----------------------------
const BOSS_LEAD_A: Note[] = [
  // ominous slow theme
  [0, 1], [3, 1], [7, 1], [10, 1],
  [12, 1], [10, 1], [7, 0.5], [3, 0.5], [0, 1],
];
const BOSS_LEAD_B: Note[] = [
  [15, 1], [14, 1], [12, 1], [10, 1],
  [10, 0.5], [12, 0.5], [10, 0.5], [7, 0.5], [3, 0.5], [0, 0.5], [-2, 1],
];
const BOSS_BASS_A: Note[] = [
  // i - bVII - bVI - V
  [0, 2], [-2, 2], [-4, 2], [-5, 2],
];
const BOSS_BASS_B: Note[] = [
  [-5, 2], [-7, 2], [0, 2], [-4, 2],
];

// Each ROAD/COMBAT variation gets a sub-theme name for the on-screen mood pill.
const VARIATIONS: Record<AudioEvent, ThemeSpec[]> = {
  TOWN: [
    {
      bpm: 88,
      songRoot: 60, // C4
      leadA: TOWN_LEAD_A,
      leadB: TOWN_LEAD_B,
      counterA: TOWN_COUNTER_A,
      counterB: TOWN_COUNTER_B,
      bassA: TOWN_BASS_A,
      bassB: TOWN_BASS_B,
      songForm: 'AABABA',
      durationSec: SINGLE_TRACK_SECONDS,
      bassWave: 'triangle',
      leadWave: 'square',
      counterWave: 'triangle',
      hasDrums: false,
      gain: 0.18,
      subTheme: 'Town · Calm',
    },
  ],
  ROAD: [
    {
      bpm: 116, songRoot: 62,
      leadA: ROAD1_LEAD_A, leadB: ROAD1_LEAD_B,
      bassA: ROAD1_BASS_A, bassB: ROAD1_BASS_B,
      songForm: 'AABABA', durationSec: VARIATION_SECONDS,
      bassWave: 'triangle', leadWave: 'square', counterWave: 'triangle',
      hasDrums: true, gain: 0.18, subTheme: 'Forest Stroll',
    },
    {
      bpm: 96, songRoot: 67,
      leadA: ROAD2_LEAD_A, leadB: ROAD2_LEAD_B,
      bassA: ROAD2_BASS_A, bassB: ROAD2_BASS_B,
      songForm: 'AABABA', durationSec: VARIATION_SECONDS,
      bassWave: 'triangle', leadWave: 'square', counterWave: 'triangle',
      hasDrums: true, gain: 0.18, subTheme: 'Mountain Pass',
    },
    {
      bpm: 104, songRoot: 64,
      leadA: ROAD3_LEAD_A, leadB: ROAD3_LEAD_B,
      bassA: ROAD3_BASS_A, bassB: ROAD3_BASS_B,
      songForm: 'AABABA', durationSec: VARIATION_SECONDS,
      bassWave: 'triangle', leadWave: 'square', counterWave: 'triangle',
      hasDrums: true, gain: 0.18, subTheme: 'River Crossing',
    },
    {
      bpm: 88, songRoot: 59,
      leadA: ROAD4_LEAD_A, leadB: ROAD4_LEAD_B,
      bassA: ROAD4_BASS_A, bassB: ROAD4_BASS_B,
      songForm: 'AABABA', durationSec: VARIATION_SECONDS,
      bassWave: 'triangle', leadWave: 'sine', counterWave: 'triangle',
      hasDrums: false, gain: 0.17, subTheme: 'Twilight Ride',
    },
    {
      bpm: 124, songRoot: 69,
      leadA: ROAD5_LEAD_A, leadB: ROAD5_LEAD_B,
      bassA: ROAD5_BASS_A, bassB: ROAD5_BASS_B,
      songForm: 'AABABA', durationSec: VARIATION_SECONDS,
      bassWave: 'triangle', leadWave: 'square', counterWave: 'triangle',
      hasDrums: true, gain: 0.19, subTheme: 'Open Plains',
    },
    {
      bpm: 108, songRoot: 66,
      leadA: ROAD6_LEAD_A, leadB: ROAD6_LEAD_B,
      bassA: ROAD6_BASS_A, bassB: ROAD6_BASS_B,
      songForm: 'AABABA', durationSec: VARIATION_SECONDS,
      bassWave: 'sawtooth', leadWave: 'square', counterWave: 'triangle',
      hasDrums: true, gain: 0.18, subTheme: 'Approaching Danger',
    },
  ],
  COMBAT: [
    {
      bpm: 144, songRoot: 64,
      leadA: C1_LEAD_A, leadB: C1_LEAD_B,
      bassA: C1_BASS_A, bassB: C1_BASS_B,
      songForm: 'AABABA', durationSec: VARIATION_SECONDS,
      bassWave: 'sawtooth', leadWave: 'square', counterWave: 'triangle',
      hasDrums: true, gain: 0.2, subTheme: 'Initial Skirmish',
    },
    {
      bpm: 136, songRoot: 60,
      leadA: C2_LEAD_A, leadB: C2_LEAD_B,
      bassA: C2_BASS_A, bassB: C2_BASS_B,
      songForm: 'AABABA', durationSec: VARIATION_SECONDS,
      bassWave: 'sawtooth', leadWave: 'square', counterWave: 'triangle',
      hasDrums: true, gain: 0.2, subTheme: 'Heroic Counter',
    },
    {
      bpm: 152, songRoot: 62,
      leadA: C3_LEAD_A, leadB: C3_LEAD_B,
      bassA: C3_BASS_A, bassB: C3_BASS_B,
      songForm: 'AABABA', durationSec: VARIATION_SECONDS,
      bassWave: 'sawtooth', leadWave: 'sawtooth', counterWave: 'triangle',
      hasDrums: true, gain: 0.21, subTheme: 'Desperate Struggle',
    },
    {
      bpm: 132, songRoot: 59,
      leadA: C4_LEAD_A, leadB: C4_LEAD_B,
      bassA: C4_BASS_A, bassB: C4_BASS_B,
      songForm: 'AABABA', durationSec: VARIATION_SECONDS,
      bassWave: 'square', leadWave: 'square', counterWave: 'triangle',
      hasDrums: true, gain: 0.2, subTheme: 'Battle of Attrition',
    },
    {
      bpm: 148, songRoot: 67,
      leadA: C5_LEAD_A, leadB: C5_LEAD_B,
      bassA: C5_BASS_A, bassB: C5_BASS_B,
      songForm: 'AABABA', durationSec: VARIATION_SECONDS,
      bassWave: 'sawtooth', leadWave: 'square', counterWave: 'triangle',
      hasDrums: true, gain: 0.21, subTheme: 'Last Stand',
    },
    {
      bpm: 140, songRoot: 57,
      leadA: C6_LEAD_A, leadB: C6_LEAD_B,
      bassA: C6_BASS_A, bassB: C6_BASS_B,
      songForm: 'AABABA', durationSec: VARIATION_SECONDS,
      bassWave: 'sawtooth', leadWave: 'sawtooth', counterWave: 'triangle',
      hasDrums: true, gain: 0.21, subTheme: 'Mortal Danger',
    },
  ],
  BOSS: [
    {
      bpm: 80, songRoot: 57, // A3
      leadA: BOSS_LEAD_A, leadB: BOSS_LEAD_B,
      bassA: BOSS_BASS_A, bassB: BOSS_BASS_B,
      songForm: 'AABABA', durationSec: SINGLE_TRACK_SECONDS,
      bassWave: 'sawtooth', leadWave: 'sawtooth', counterWave: 'triangle',
      hasDrums: true, gain: 0.22, subTheme: 'Boss · Heavy',
    },
  ],
  VICTORY_STINGER: [],
  QUEST_COMPLETE: [],
  QUEST_FAILED: [],
  PAUSE_BELL: [],
};

// ============================================================================
// Rendering
// ============================================================================

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

interface ScheduledNote {
  midi: number;
  start: number;
  duration: number;
  wave: Wave;
  gain: number;
  attack?: number;
  release?: number;
}

function scheduleNote(ctx: OfflineAudioContext, dest: AudioNode, n: ScheduledNote): void {
  const osc = ctx.createOscillator();
  osc.type = n.wave;
  osc.frequency.value = midiToFreq(n.midi);

  const env = ctx.createGain();
  const attack = n.attack ?? 0.01;
  const release = n.release ?? 0.05;
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

function scheduleSnare(ctx: OfflineAudioContext, dest: AudioNode, start: number, gain: number): void {
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

function scheduleKick(ctx: OfflineAudioContext, dest: AudioNode, start: number, gain: number): void {
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

// Schedule one melodic line (lead/counter/bass) with offset semitones from songRoot.
function scheduleVoice(
  ctx: OfflineAudioContext,
  dest: AudioNode,
  notes: Note[],
  songRoot: number,
  octaveOffset: number, // 0 = same octave as songRoot, +12/-12 etc
  startSec: number,
  beatSec: number,
  wave: Wave,
  gain: number,
  legato = 0.92,
): number {
  let t = startSec;
  for (const [pitch, durationBeats] of notes) {
    const dur = durationBeats * beatSec;
    if (!isRest([pitch, durationBeats])) {
      scheduleNote(ctx, dest, {
        midi: songRoot + octaveOffset + pitch,
        start: t,
        duration: dur * legato,
        wave,
        gain,
      });
    }
    t += dur;
  }
  return t;
}

function totalBeats(notes: Note[]): number {
  return notes.reduce((acc, [, d]) => acc + d, 0);
}

function buildOfflineContextSafely(seconds: number): OfflineAudioContext {
  const length = Math.max(1, Math.floor(seconds * SAMPLE_RATE));
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

export async function synthesizeTheme(
  event: AudioEvent,
  variationIndex = 0,
): Promise<AudioBuffer | null> {
  const spec = VARIATIONS[event]?.[variationIndex];
  if (!spec) return null;

  const ctx = buildOfflineContextSafely(spec.durationSec);

  const master = ctx.createGain();
  master.gain.value = spec.gain;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 6500;
  lp.Q.value = 0.5;
  master.connect(lp);
  lp.connect(ctx.destination);

  const beatSec = 60 / spec.bpm;
  // One "section" (A or B) is the duration of the lead phrase.
  const sectionBeatsA = totalBeats(spec.leadA);
  const sectionBeatsB = totalBeats(spec.leadB);
  const songForm = spec.songForm;

  // Build the song timeline: walk through songForm letters, render each section
  // until we hit durationSec.
  let t = 0;
  let formIdx = 0;
  while (t < spec.durationSec - 0.5) {
    const letter = songForm[formIdx % songForm.length]!;
    const isA = letter === 'A';
    const lead = isA ? spec.leadA : spec.leadB;
    const counter = isA ? spec.counterA : spec.counterB;
    const bass = isA ? spec.bassA : spec.bassB;
    const sectionBeats = isA ? sectionBeatsA : sectionBeatsB;
    const sectionSec = sectionBeats * beatSec;

    // Lead — one octave above songRoot
    scheduleVoice(ctx, master, lead, spec.songRoot, 12, t, beatSec, spec.leadWave, 0.18, 0.85);

    // Counter — same octave or 1 below (depending on theme), softer
    if (counter && counter.length > 0) {
      scheduleVoice(ctx, master, counter, spec.songRoot, 0, t, beatSec, spec.counterWave, 0.09, 0.9);
    }

    // Bass — one octave below songRoot
    scheduleVoice(ctx, master, bass, spec.songRoot, -12, t, beatSec, spec.bassWave, 0.4, 0.95);

    // Drums on every beat for action themes
    if (spec.hasDrums) {
      const beatsInSection = Math.round(sectionBeats);
      for (let b = 0; b < beatsInSection; b++) {
        const beatTime = t + b * beatSec;
        // Kick on 1 and 3, snare on 2 and 4 (assuming 4/4)
        const beatInMeasure = b % 4;
        if (beatInMeasure === 0 || beatInMeasure === 2) {
          scheduleKick(ctx, master, beatTime, 0.42);
        }
        if (beatInMeasure === 1 || beatInMeasure === 3) {
          scheduleSnare(ctx, master, beatTime, 0.28);
        }
      }
    }

    t += sectionSec;
    formIdx++;
  }

  return ctx.startRendering();
}

export function isProceduralTheme(event: AudioEvent): boolean {
  return LOOPING_EVENTS.has(event) && getVariationCount(event) > 0;
}

export function getVariationCount(event: AudioEvent): number {
  return VARIATIONS[event]?.length ?? 0;
}

export function getThemeSubTitle(event: AudioEvent, variationIndex: number): string | undefined {
  return VARIATIONS[event]?.[variationIndex]?.subTheme;
}
