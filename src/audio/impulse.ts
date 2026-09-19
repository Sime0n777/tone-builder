/** Generate a decaying noise impulse for crude reverb / cab character. */
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

/** Short cab-like IR: band-limited noise burst with resonance. */
export function makeCabImpulse(
  ctx: BaseAudioContext,
  kind: CabKind = 'generic',
): AudioBuffer {
  const rate = ctx.sampleRate;
  // Open-back deluxe is a touch longer / airier; closed 4x12s are snappier
  const length = Math.floor(rate * (kind === 'deluxe' || kind === 'blue' ? 0.1 : 0.08));
  const buffer = ctx.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);

  // Different spectral tilts approximate different speakers
  // deluxe: brighter open-back Oxford/Jensen-ish vs closed 4x12
  const tilt =
    kind === 'v30'
      ? 1.15
      : kind === 'greenback'
        ? 0.95
        : kind === 'blue'
          ? 0.75
          : kind === 'deluxe'
            ? 0.85
            : 1;
  const bright =
    kind === 'v30'
      ? 0.55
      : kind === 'greenback'
        ? 0.4
        : kind === 'blue'
          ? 0.3
          : kind === 'deluxe'
            ? 0.62
            : 0.35;
  const damp = kind === 'deluxe' || kind === 'blue' ? 22 : 28;

  let lp = 0;
  for (let i = 0; i < length; i++) {
    const t = i / length;
    const env = Math.exp(-t * damp) * (1 - t);
    const noise = Math.random() * 2 - 1;
    lp = lp * 0.85 + noise * 0.15;
    const hf = noise - lp;
    // Mild low-mid bump for open-back combo warmth
    const mid = kind === 'deluxe' ? Math.sin(t * Math.PI) * 0.15 * lp : 0;
    data[i] = (lp * tilt + hf * bright + mid) * env * 2.2;
  }
  return buffer;
}
