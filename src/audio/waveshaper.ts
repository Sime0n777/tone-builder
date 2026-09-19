/**
 * Nonlinear transfer curves for drive pedals and algorithmic amp stages.
 * Soft/hard clipping + asymmetric "tube" flavors — not neural captures.
 */

export type CurveStyle = 'soft' | 'hard' | 'tube' | 'fuzz';

/** Build a soft/hard/tube clipping curve. amount 0..1. */
export function makeDriveCurve(
  amount: number,
  samples = 2048,
  style: CurveStyle = 'soft',
  asymmetry = 0,
): Float32Array {
  const curve = new Float32Array(samples);
  const a = Math.min(1, Math.max(0, amount));
  const asym = Math.min(0.8, Math.max(0, asymmetry));

  for (let i = 0; i < samples; i++) {
    let x = (i * 2) / samples - 1;
    // Mild DC bias for even-order harmonics (tube-ish)
    if (asym > 0) x = x + asym * 0.12 * (1 - Math.abs(x));

    let y: number;
    if (style === 'hard') {
      const k = 2 + a * 40;
      y = Math.tanh(x * k) / Math.tanh(k);
      // Harder knee at high amount
      if (a > 0.55) {
        const clip = 0.85 - (a - 0.55) * 0.4;
        y = Math.max(-clip, Math.min(clip, y)) / clip;
      }
    } else if (style === 'fuzz') {
      const k = 4 + a * 90;
      y = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
      y = Math.tanh(y * (1.2 + a)) * (0.9 + a * 0.15);
    } else if (style === 'tube') {
      // Asymmetric soft saturation — more compression on positive peaks
      const kPos = 1.5 + a * 28;
      const kNeg = 1.2 + a * 18 * (1 - asym * 0.4);
      if (x >= 0) {
        y = Math.tanh(x * kPos) / Math.tanh(kPos);
      } else {
        y = Math.tanh(x * kNeg) / Math.tanh(kNeg);
      }
      // Gentle quadratic warmth at low drive
      y = y * (0.92 + a * 0.08) + x * x * x * (0.04 * (1 - a));
    } else {
      // soft (default)
      const k = 1 + a * 80;
      y = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
    }

    curve[i] = y;
  }
  return curve;
}

export function applyDriveCurve(
  shaper: WaveShaperNode,
  amount: number,
  style: CurveStyle = 'soft',
  asymmetry = 0,
) {
  // Cast avoids DOM lib Float32Array<ArrayBuffer> vs ArrayBufferLike mismatch
  shaper.curve = makeDriveCurve(amount, 2048, style, asymmetry) as never;
}

export function driveAmountFromParams(
  category: string,
  params: Record<string, number | string | boolean>,
): number {
  if (category === 'drive') {
    const g =
      Number(params.drive ?? params.distortion ?? params.fuzz ?? params.gain ?? 5) / 10;
    return Math.min(1, Math.max(0, g * 0.85));
  }
  if (category === 'amp') {
    const g = Number(params.gain ?? params.volume ?? params.brilliantVol ?? 5) / 10;
    if (params.channel === 'Modern' || params.channel === 'Red') {
      return Math.min(1, 0.35 + g * 0.7);
    }
    return Math.min(1, g * 0.55);
  }
  return 0;
}
