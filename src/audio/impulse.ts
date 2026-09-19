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

/** Short cab-like IR: band-limited noise burst with resonance. */
export function makeCabImpulse(
  ctx: BaseAudioContext,
  kind: 'greenback' | 'v30' | 'blue' | 'generic' = 'generic',
): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * 0.08);
  const buffer = ctx.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);

  // Different spectral tilts approximate different speakers
  const tilt =
    kind === 'v30' ? 1.15 : kind === 'greenback' ? 0.95 : kind === 'blue' ? 0.75 : 1;
  const bright =
    kind === 'v30' ? 0.55 : kind === 'greenback' ? 0.4 : kind === 'blue' ? 0.3 : 0.35;

  let lp = 0;
  for (let i = 0; i < length; i++) {
    const t = i / length;
    const env = Math.exp(-t * 28) * (1 - t);
    const noise = Math.random() * 2 - 1;
    lp = lp * 0.85 + noise * 0.15;
    const hf = noise - lp;
    data[i] = (lp * tilt + hf * bright) * env * 2.2;
  }
  return buffer;
}
