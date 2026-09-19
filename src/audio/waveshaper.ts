/** Build a soft/hard clipping curve for drive / amp saturation. */
export function makeDriveCurve(amount: number, samples = 2048): Float32Array {
  const curve = new Float32Array(samples);
  // amount 0..1 → mild to heavy
  const k = 1 + amount * 80;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

export function applyDriveCurve(shaper: WaveShaperNode, amount: number) {
  // Cast avoids DOM lib Float32Array<ArrayBuffer> vs ArrayBufferLike mismatch
  shaper.curve = makeDriveCurve(amount) as never;
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
