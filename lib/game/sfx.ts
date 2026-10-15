// Tiny Web Audio synth for the roll reveal. No audio files, no network.
// Sound can be turned off; the choice is remembered in localStorage.

const KEY = "luckline:sound";
let ctx: AudioContext | null = null;

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

// C major pentatonic, two octaves: every combination sounds pleasant.
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];

export const sfx = {
  /** Call inside the click handler so browsers allow audio. */
  unlock() {
    audio();
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
