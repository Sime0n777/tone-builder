/**
 * Algorithmic amp-sim voicing profiles for Tone Builder.
 *
 * These are hand-tuned DSP approximations (gain staging, tone-stack topology,
 * nonlinear stages, sag/presence) — NOT neural network captures (NAM/ToneX).
 * They aim for clearly differentiated factory amp flavors you pick and play.
 */

export type AmpFamily = 'fender' | 'marshall' | 'vox' | 'mesa' | 'soldano';

export interface AmpVoice {
  /** Stable id matching blockCatalog typeId */
  typeId: string;
  family: AmpFamily;
  label: string;
  /** How early the preamp breaks up (0 = clean headroom, 1 = early grit) */
  preampSensitivity: number;
  /** Extra preamp drive multiplier after user gain */
  preampDriveScale: number;
  /** Soft asymmetric tube character 0..1 (higher = more even-order) */
  preampAsymmetry: number;
  /** Power-amp stage drive relative to master */
  powerDriveScale: number;
  /** Compressor-ish sag amount 0..1 when pushed */
  sag: number;
  /** Input high-pass (Hz) — tightens low end before preamp */
  inputHpfHz: number;
  /** Bright-cap shelf frequency when Bright is on (Hz); 0 = no bright path */
  brightCapHz: number;
  /** Bright shelf gain (dB) when Bright is on */
  brightCapDb: number;
  /** Tone-stack mid center (Hz) */
  midFreqHz: number;
  /** Tone-stack mid Q */
  midQ: number;
  /** Bass shelf frequency */
  bassFreqHz: number;
  /** Treble shelf / cut frequency */
  trebleFreqHz: number;
  /** Presence / cut peaking frequency */
  presenceFreqHz: number;
  /** Fixed mid bias (dB) baked into the voice (e.g. Rectifier scoop) */
  midBiasDb: number;
  /** Fixed treble bias (dB) */
  trebleBiasDb: number;
  /** Fixed bass bias (dB) */
  bassBiasDb: number;
  /** Presence bias (dB) at knob = 5 */
  presenceBiasDb: number;
  /** Use Vox-style Cut (higher cut = less top) instead of Presence */
  useCutControl: boolean;
  /** Master / out level trim */
  outputTrim: number;
}

export const AMP_VOICES: Record<string, AmpVoice> = {
  'twin-reverb': {
    typeId: 'twin-reverb',
    family: 'fender',
    label: 'Twin Reverb',
    preampSensitivity: 0.18,
    preampDriveScale: 0.55,
    preampAsymmetry: 0.35,
    powerDriveScale: 0.25,
    sag: 0.12,
    inputHpfHz: 55,
    brightCapHz: 3500,
    brightCapDb: 4.5,
    midFreqHz: 450,
    midQ: 0.7,
    bassFreqHz: 100,
    trebleFreqHz: 3200,
    presenceFreqHz: 4800,
    midBiasDb: 0.5,
    trebleBiasDb: 0.5,
    bassBiasDb: 0,
    presenceBiasDb: 1.5,
    useCutControl: false,
    outputTrim: 0.95,
  },
  'deluxe-reverb': {
    typeId: 'deluxe-reverb',
    family: 'fender',
    label: 'Deluxe Reverb',
    // Earlier blackface breakup than Twin — edge-of-breakup at moderate volume
    preampSensitivity: 0.42,
    preampDriveScale: 0.85,
    preampAsymmetry: 0.45,
    powerDriveScale: 0.55,
    sag: 0.35,
    inputHpfHz: 60,
    brightCapHz: 2800,
    brightCapDb: 3.2,
    midFreqHz: 500,
    midQ: 0.75,
    bassFreqHz: 110,
    trebleFreqHz: 3000,
    presenceFreqHz: 4200,
    midBiasDb: 1.5,
    trebleBiasDb: 0.8,
    bassBiasDb: -0.5,
    presenceBiasDb: 1.2,
    useCutControl: false,
    outputTrim: 1.0,
  },
  plexiglas: {
    typeId: 'plexiglas',
    family: 'marshall',
    label: 'Plexi 100W',
    preampSensitivity: 0.55,
    preampDriveScale: 1.05,
    preampAsymmetry: 0.25,
    powerDriveScale: 0.7,
    sag: 0.4,
    inputHpfHz: 75,
    brightCapHz: 0,
    brightCapDb: 0,
    midFreqHz: 750,
    midQ: 0.95,
    bassFreqHz: 130,
    trebleFreqHz: 3500,
    presenceFreqHz: 3500,
    midBiasDb: 2.5,
    trebleBiasDb: 1.0,
    bassBiasDb: -1.5,
    presenceBiasDb: 0,
    useCutControl: false,
    outputTrim: 0.92,
  },
  rectifier: {
    typeId: 'rectifier',
    family: 'mesa',
    label: 'Dual Rectifier',
    preampSensitivity: 0.85,
    preampDriveScale: 1.45,
    preampAsymmetry: 0.15,
    powerDriveScale: 0.9,
    sag: 0.55,
    inputHpfHz: 95,
    brightCapHz: 0,
    brightCapDb: 0,
    midFreqHz: 800,
    midQ: 1.1,
    bassFreqHz: 140,
    trebleFreqHz: 3800,
    presenceFreqHz: 4200,
    midBiasDb: -4.5,
    trebleBiasDb: 1.5,
    bassBiasDb: 0.5,
    presenceBiasDb: 0.5,
    useCutControl: false,
    outputTrim: 0.88,
  },

  bassman: {
    typeId: 'bassman',
    family: 'fender',
    label: 'Bassman',
    preampSensitivity: 0.48,
    preampDriveScale: 0.9,
    preampAsymmetry: 0.4,
    powerDriveScale: 0.6,
    sag: 0.38,
    inputHpfHz: 50,
    brightCapHz: 2500,
    brightCapDb: 2.8,
    midFreqHz: 480,
    midQ: 0.7,
    bassFreqHz: 90,
    trebleFreqHz: 2800,
    presenceFreqHz: 3800,
    midBiasDb: 2.0,
    trebleBiasDb: -0.5,
    bassBiasDb: 2.5,
    presenceBiasDb: 0.5,
    useCutControl: false,
    outputTrim: 0.96,
  },
  jcm800: {
    typeId: 'jcm800',
    family: 'marshall',
    label: 'JCM800',
    preampSensitivity: 0.7,
    preampDriveScale: 1.25,
    preampAsymmetry: 0.2,
    powerDriveScale: 0.75,
    sag: 0.42,
    inputHpfHz: 85,
    brightCapHz: 0,
    brightCapDb: 0,
    midFreqHz: 780,
    midQ: 1.05,
    bassFreqHz: 135,
    trebleFreqHz: 3600,
    presenceFreqHz: 3600,
    midBiasDb: 3.0,
    trebleBiasDb: 1.5,
    bassBiasDb: -2.0,
    presenceBiasDb: 0.5,
    useCutControl: false,
    outputTrim: 0.9,
  },
  slo100: {
    typeId: 'slo100',
    family: 'soldano',
    label: 'SLO-100',
    preampSensitivity: 0.78,
    preampDriveScale: 1.35,
    preampAsymmetry: 0.18,
    powerDriveScale: 0.85,
    sag: 0.48,
    inputHpfHz: 90,
    brightCapHz: 0,
    brightCapDb: 0,
    midFreqHz: 720,
    midQ: 0.9,
    bassFreqHz: 125,
    trebleFreqHz: 3400,
    presenceFreqHz: 4000,
    midBiasDb: 3.5,
    trebleBiasDb: 0.5,
    bassBiasDb: 0.5,
    presenceBiasDb: 0.8,
    useCutControl: false,
    outputTrim: 0.88,
  },
  ac30: {
    typeId: 'ac30',
    family: 'vox',
    label: 'AC30 Top Boost',
    preampSensitivity: 0.4,
    preampDriveScale: 0.75,
    preampAsymmetry: 0.55,
    powerDriveScale: 0.5,
    sag: 0.28,
    inputHpfHz: 70,
    brightCapHz: 0,
    brightCapDb: 0,
    midFreqHz: 900,
    midQ: 0.65,
    bassFreqHz: 120,
    trebleFreqHz: 4500,
    presenceFreqHz: 5500,
    midBiasDb: 0.5,
    trebleBiasDb: 2.5,
    bassBiasDb: -2.0,
    presenceBiasDb: 0,
    useCutControl: true,
    outputTrim: 0.98,
  },
};

export function getAmpVoice(typeId: string): AmpVoice {
  return (
    AMP_VOICES[typeId] ?? {
      typeId,
      family: 'fender',
      label: typeId,
      preampSensitivity: 0.4,
      preampDriveScale: 0.8,
      preampAsymmetry: 0.3,
      powerDriveScale: 0.5,
      sag: 0.25,
      inputHpfHz: 65,
      brightCapHz: 3000,
      brightCapDb: 3,
      midFreqHz: 700,
      midQ: 0.8,
      bassFreqHz: 120,
      trebleFreqHz: 3200,
      presenceFreqHz: 4500,
      midBiasDb: 0,
      trebleBiasDb: 0,
      bassBiasDb: 0,
      presenceBiasDb: 0,
      useCutControl: false,
      outputTrim: 1,
    }
  );
}

/** Map channel select (Rectifier) into extra drive + mid bias. */
export function channelDriveBias(channel: string | number | boolean | undefined): {
  driveMul: number;
  midExtraDb: number;
} {
  if (channel === 'Modern' || channel === 'Red') {
    return { driveMul: 1.35, midExtraDb: channel === 'Modern' ? -2 : -1 };
  }
  if (channel === 'Orange') {
    return { driveMul: 0.85, midExtraDb: 1.5 };
  }
  if (channel === 'Lead') {
    return { driveMul: 1.25, midExtraDb: 1.5 };
  }
  if (channel === 'Crunch') {
    return { driveMul: 0.9, midExtraDb: 0.5 };
  }
  return { driveMul: 1, midExtraDb: 0 };
}
