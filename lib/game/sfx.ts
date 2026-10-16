// Tiny Web Audio synth for the roll reveal and the UI. No audio files, no network.
// Sound can be turned off; the choice is remembered in localStorage.

const KEY = "luckline:sound";
let ctx: AudioContext | null = null;
const listeners = new Set<() => void>();

/** Subscribe to mute/unmute (every sound toggle on the page stays in sync). */
export function onSoundChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Storage blocked: the toggle still works for this page view.
  }
  if (!on && ctx) void ctx.suspend();
  listeners.forEach((cb) => cb());
}

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !soundEnabled()) return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, delay: number, dur: number, type: OscillatorType = "sine", gain = 0.08) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** A tone whose pitch glides from one frequency to another: kicks, zaps, drops. */
function sweep(from: number, to: number, dur: number, type: OscillatorType = "sine", gain = 0.1, delay = 0) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

let noiseBuffer: AudioBuffer | null = null;

/** A short burst of filtered noise: clacks, shakes and whooshes. */
function noise(delay: number, dur: number, freq: number, gain = 0.08, q = 1.2, sweepTo?: number) {
  const c = audio();
  if (!c) return;
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, t);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const amp = c.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.01, dur / 3));
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(amp).connect(c.destination);
  src.start(t, Math.random() * 0.5, dur + 0.05);
}

// C major pentatonic, two octaves: every combination sounds pleasant.
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];

export const sfx = {
  /** Call inside the click handler so browsers allow audio. */
  unlock() {
    audio();
  },
  // --- UI sounds: short, soft and consistent -----------------------------
  /** Any button or link. */
  click() {
    tone(620, 0, 0.045, "triangle", 0.035);
    tone(930, 0.012, 0.04, "sine", 0.02);
  },
  /** Moving to another page. */
  nav() {
    noise(0, 0.16, 500, 0.04, 0.8, 2400);
    tone(740, 0.03, 0.06, "sine", 0.025);
  },
  /** A switch flipped. */
  toggle(on: boolean) {
    tone(on ? 520 : 400, 0, 0.06, "triangle", 0.05);
    tone(on ? 780 : 300, 0.05, 0.08, "triangle", 0.05);
  },
  /** A dialog opening or closing. */
  open() {
    noise(0, 0.14, 700, 0.03, 0.7, 1800);
    tone(660, 0.04, 0.09, "sine", 0.03);
  },
  close() {
    noise(0, 0.12, 1600, 0.025, 0.7, 500);
    tone(440, 0, 0.08, "sine", 0.025);
  },
  /** Something worked (copied, saved, uploaded). */
  success() {
    tone(784, 0, 0.1, "sine", 0.06);
    tone(1046.5, 0.08, 0.18, "sine", 0.06);
  },
  error() {
    tone(220, 0, 0.12, "sawtooth", 0.03);
    tone(180, 0.1, 0.18, "sawtooth", 0.03);
  },
  /** Spending EP: a coin clink. */
  coin() {
    tone(1568, 0, 0.12, "square", 0.025);
    tone(2093, 0.07, 0.3, "square", 0.02);
    noise(0, 0.05, 6000, 0.02, 2);
  },
  /** Dice shaken in a cup, then thrown. */
  rattle() {
    for (let i = 0; i < 9; i++) {
      noise(i * 0.055 + Math.random() * 0.02, 0.04, 1200 + Math.random() * 2200, 0.05 + Math.random() * 0.03, 3);
    }
    noise(0.55, 0.12, 300, 0.07, 1);
  },
  /** The wheel clicking over a peg. */
  peg() {
    tone(1200, 0, 0.02, "square", 0.012);
  },
  tick() {
    tone(300 + Math.random() * 500, 0, 0.025, "square", 0.012);
  },
  lock(i: number) {
    tone(SCALE[Math.min(i, SCALE.length - 1)], 0, 0.14, "triangle", 0.08);
  },
  suspense() {
    tone(110, 0, 0.9, "sawtooth", 0.025);
    tone(116.5, 0, 0.9, "sawtooth", 0.02);
  },
  /** A heavy digit landing: sub-bass drop, a crack and a low rumble. power ~1 (soft) to 2 (huge). */
  thud(power = 1) {
    const p = Math.min(2.2, Math.max(0.5, power));
    sweep(150, 38, 0.5, "sine", 0.28 * p);
    sweep(90, 30, 0.7, "sine", 0.16 * p, 0.02);
    noise(0, 0.1, 2600, 0.05 * p, 0.9); // the crack
    noise(0.01, 0.35, 140, 0.12 * p, 0.7, 60); // the rumble
  },
  /** A low double thump, for the tension before a very rare roll lands. */
  heartbeat() {
    tone(62, 0, 0.16, "sine", 0.22);
    tone(55, 0.17, 0.2, "sine", 0.16);
  },
  /** rank: 1 common … 6 mythic */
  badge(rank: number) {
    const base = SCALE[Math.min(rank + 1, SCALE.length - 2)];
    tone(base, 0, 0.18, "sine", 0.07);
    tone(base * 1.5, 0.07, 0.25, "sine", 0.05);
  },
  /** rank: 0 trash … 6 mythic */
  tier(rank: number) {
    if (rank <= 0) {
      tone(220, 0, 0.25, "triangle", 0.06);
      tone(185, 0.18, 0.4, "triangle", 0.06);
      return;
    }
    const notes = Math.min(2 + rank, SCALE.length);
    for (let i = 0; i < notes; i++) tone(SCALE[i], i * 0.07, 0.3, "triangle", 0.07);
    if (rank >= 4) {
      const end = notes * 0.07;
      for (const f of [523.25, 659.25, 783.99, 1046.5]) tone(f, end, 1.2, "sine", 0.05);
    }
    if (rank >= 6) {
      for (let i = 0; i < 8; i++) tone(SCALE[SCALE.length - 1 - (i % 4)], 0.9 + i * 0.06, 0.2, "square", 0.02);
    }
  },
};

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported: ignore.
  }
}
