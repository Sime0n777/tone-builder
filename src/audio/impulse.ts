/**
 * Generated impulse responses for reverb and factory cab sims.
 *
 * Cab IRs are short algorithmic speaker/mic approximations (resonant modes +
 * spectral envelope) — not measured commercial IR packs. Enough character for
 * clearly different cabs and audible mic/position/distance moves.
 */

/** Generate a decaying noise impulse for crude reverb character. */
export function makeReverbImpulse(
  ctx: BaseAudioContext,
  seconds: number,
  decay: number,
  reverse = false,
): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const buffer = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const env = Math.pow(1 - t, decay);
      const n = (Math.random() * 2 - 1) * env;
      data[reverse ? length - 1 - i : i] = n * (ch === 0 ? 1 : 0.92);
    }
  }
  return buffer;
}

export type CabKind = 'greenback' | 'v30' | 'blue' | 'deluxe' | 'generic';

export type MicKind = 'SM57' | 'MD421' | 'R121' | 'U87' | string;

interface CabSpec {
  /** IR length in seconds */
  duration: number;
  /** Envelope damp rate */
  damp: number;
  /** Resonant mode freqs (Hz) + relative amplitudes */
  modes: { f: number; a: number; q: number }[];
  /** Low-shelf tilt (relative) */
  lowTilt: number;
  /** High-end air 0..1 */
  air: number;
  /** Closed-back boom factor */
  closed: number;
}

const CAB_SPECS: Record<CabKind, CabSpec> = {
  // 1×12 open-back Deluxe — airy, Oxford/Jensen-ish sparkle, less boom
  deluxe: {
    duration: 0.14,
    damp: 18,
    modes: [
      { f: 95, a: 0.55, q: 4 },
      { f: 220, a: 0.7, q: 3.5 },
      { f: 480, a: 0.45, q: 2.5 },
      { f: 1200, a: 0.35, q: 2 },
      { f: 2800, a: 0.55, q: 2.2 },
      { f: 5200, a: 0.4, q: 1.8 },
    ],
    lowTilt: 0.75,
    air: 0.72,
    closed: 0.15,
  },
  // 2×12 open-back Blue Alnico — warm, rounded, less top than Deluxe
  blue: {
    duration: 0.13,
    damp: 20,
    modes: [
      { f: 85, a: 0.65, q: 4.5 },
      { f: 200, a: 0.8, q: 3.2 },
      { f: 420, a: 0.5, q: 2.8 },
      { f: 900, a: 0.4, q: 2.2 },
      { f: 2200, a: 0.35, q: 2 },
      { f: 4200, a: 0.25, q: 1.6 },
    ],
    lowTilt: 0.9,
    air: 0.45,
    closed: 0.2,
  },
  // 4×12 Greenback — classic British, mid punch, controlled top
  greenback: {
    duration: 0.11,
    damp: 26,
    modes: [
      { f: 110, a: 0.7, q: 5 },
      { f: 250, a: 0.85, q: 3.8 },
      { f: 550, a: 0.75, q: 3 },
      { f: 1100, a: 0.55, q: 2.5 },
      { f: 2500, a: 0.45, q: 2.2 },
      { f: 4500, a: 0.3, q: 1.8 },
    ],
    lowTilt: 1.05,
    air: 0.4,
    closed: 0.75,
  },
  // 4×12 V30 — modern aggression, scooped-ish mid scoop edge, strong 3–5k
  v30: {
    duration: 0.1,
    damp: 30,
    modes: [
      { f: 120, a: 0.8, q: 5.5 },
      { f: 280, a: 0.7, q: 4 },
      { f: 600, a: 0.45, q: 2.8 },
      { f: 1400, a: 0.5, q: 2.5 },
      { f: 3200, a: 0.75, q: 2.8 },
      { f: 5800, a: 0.5, q: 2 },
    ],
    lowTilt: 1.15,
    air: 0.55,
    closed: 0.9,
  },
  generic: {
    duration: 0.1,
    damp: 24,
    modes: [
      { f: 100, a: 0.6, q: 4 },
      { f: 400, a: 0.55, q: 2.5 },
      { f: 2000, a: 0.45, q: 2 },
      { f: 4500, a: 0.35, q: 1.8 },
    ],
    lowTilt: 1,
    air: 0.4,
    closed: 0.5,
  },
};

/** Mic frequency color: relative HF / mid presence multipliers. */
function micColor(mic: MicKind): { hf: number; presence: number; body: number } {
  switch (mic) {
    case 'SM57':
      // Dynamic — presence peak ~5k, rolled lows
      return { hf: 0.85, presence: 1.35, body: 0.75 };
    case 'MD421':
      // Sennheiser — fuller body, smooth top
      return { hf: 0.95, presence: 1.1, body: 1.15 };
    case 'R121':
      // Ribbon — dark, smooth, scooped extreme top
      return { hf: 0.55, presence: 0.75, body: 1.25 };
    case 'U87':
      // Condenser — airy, extended top, fuller bottom
      return { hf: 1.25, presence: 1.05, body: 1.1 };
    default:
      return { hf: 1, presence: 1, body: 1 };
  }
}

export interface CabIrOptions {
  mic?: MicKind;
  /** 0 = on-axis (bright), 10 = far off-axis (dark) */
  position?: number;
  /** 0 = close, 10 = far — HF rolloff + room wash */
  distance?: number;
  /** Open-back room wash 0..10 */
  room?: number;
}

/**
 * Higher-quality short cab IR: multi-mode resonant burst + mic/position/distance.
 * Deterministic-ish seed from kind so rebuilds sound consistent.
 */
export function makeCabImpulse(
  ctx: BaseAudioContext,
  kind: CabKind = 'generic',
  options: CabIrOptions = {},
): AudioBuffer {
  const spec = CAB_SPECS[kind] ?? CAB_SPECS.generic;
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * spec.duration);
  const buffer = ctx.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);

  const mic = micColor(options.mic ?? 'SM57');
  const position = Math.min(10, Math.max(0, Number(options.position ?? 3))) / 10;
  const distance = Math.min(10, Math.max(0, Number(options.distance ?? 2))) / 10;
  const room = Math.min(10, Math.max(0, Number(options.room ?? 0))) / 10;

  // Off-axis: dull HF, slight mid scoop shift
  const axisHf = 1 - position * 0.55;
  const axisPresence = 1 - position * 0.25;
  // Distance: more HF loss + slower decay wash
  const distHf = 1 - distance * 0.45;
  const distDamp = spec.damp * (1 - distance * 0.25);

  // Seeded LCG for repeatable noise texture per cab kind
  let seed =
    kind === 'v30' ? 7919 : kind === 'greenback' ? 4243 : kind === 'blue' ? 3319 : kind === 'deluxe' ? 6151 : 1009;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed / 2147483647) * 2 - 1;
  };

  // Precompute mode angular freqs
  const modes = spec.modes.map((m) => ({
    w: (2 * Math.PI * m.f) / rate,
    a: m.a,
    decay: Math.exp(-m.f / (rate * m.q * 0.08)),
    phase: 0,
  }));

  let lp = 0;
  let lp2 = 0;
  for (let i = 0; i < length; i++) {
    const t = i / length;
    const env = Math.exp(-t * distDamp) * (1 - t * 0.85);

    // Excitation: short noise burst at start
    const excite = i < rate * 0.004 ? rand() * (1 - i / (rate * 0.004)) : rand() * 0.08 * (1 - t);

    // Resonant modes
    let resonant = 0;
    for (const m of modes) {
      m.phase += m.w;
      const modeEnv = Math.pow(m.decay, i);
      resonant += Math.sin(m.phase) * m.a * modeEnv * excite;
    }

    // Broadband filtered noise body
    const noise = rand();
    lp = lp * 0.88 + noise * 0.12;
    lp2 = lp2 * 0.96 + lp * 0.04;
    const hf = (noise - lp) * spec.air * mic.hf * axisHf * distHf;
    const body = lp2 * spec.lowTilt * mic.body * (0.7 + spec.closed * 0.4);
    const presence =
      (lp - lp2) * 0.9 * mic.presence * axisPresence * (kind === 'v30' ? 1.2 : 1);

    // Early "room" wash for open-backs — delayed noise tail
    const roomSample =
      room > 0.01 && i > rate * 0.008
        ? rand() * room * 0.18 * Math.exp(-(t - 0.08) * 12) * (kind === 'deluxe' || kind === 'blue' ? 1.3 : 0.6)
        : 0;

    data[i] = (resonant * 1.8 + body + presence + hf + roomSample) * env * 2.4;
  }

  // Normalize to ~0.9 peak
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const v = Math.abs(data[i]!);
    if (v > peak) peak = v;
  }
  if (peak > 1e-6) {
    const inv = 0.9 / peak;
    for (let i = 0; i < length; i++) data[i]! *= inv;
  }

  return buffer;
}

export function cabKindFromTypeId(typeId: string): CabKind {
  if (typeId.includes('v30')) return 'v30';
  if (typeId.includes('green')) return 'greenback';
  if (typeId.includes('blue')) return 'blue';
  if (typeId.includes('deluxe')) return 'deluxe';
  return 'generic';
}
