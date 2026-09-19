import type { TonePreset } from '../types/tone';
import { createBlockParams } from './blockCatalog';

function block(typeId: string, overrides: Record<string, number | string | boolean> = {}) {
  return {
    id: crypto.randomUUID(),
    typeId,
    params: { ...createBlockParams(typeId), ...overrides },
  };
}

const now = new Date().toISOString();

export const SEED_TONES: TonePreset[] = [
  {
    id: 'seed-clean-jazz',
    name: 'Clean Jazz',
    notes:
      'Warm, round jazz cleans. Roll tone back on the guitar, neck pickup, soft attack. Twin Reverb with mild spring, light chorus for movement — no drive. Great for chord melody and walking bass lines.',
    chain: [
      block('chorus', { rate: 0.8, depth: 2.5, mix: 20 }),
      block('twin-reverb', {
        volume: 3.5,
        treble: 4,
        middle: 6,
        bass: 6.5,
        reverb: 2,
        bright: false,
      }),
      block('spring-reverb', { dwell: 3, mix: 18, tone: 4 }),
      block('2x12-blue', { mic: 'R121', position: 5, distance: 4, room: 3 }),
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'seed-classic-crunch',
    name: 'Classic Rock Crunch',
    notes:
      'Plexi crunch with a touch of Tube Screamer for mid push. Bridge humbucker or PAF-style. Edge-of-breakup rhythm; kick the TS for solos. Greenbacks + SM57 on the cone edge.',
    chain: [
      block('tube-screamer', { drive: 3, tone: 5.5, level: 6 }),
      block('plexiglas', {
        presence: 5.5,
        bass: 3.5,
        middle: 6.5,
        treble: 6,
        volume: 5.5,
      }),
      block('analog-delay', { time: 380, feedback: 28, mix: 18 }),
      block('4x12-greenbacks', {
        mic: 'SM57',
        position: 3,
        distance: 2,
        lowCut: 80,
        highCut: 10000,
      }),
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'seed-modern-highgain',
    name: 'Modern High-Gain',
    notes:
      'Tight modern metal / hard rock. Rectifier on Modern, mid scoop, V30 cab. Gate recommended in the real world. Drop the gain a notch for palm-muted chugs; boost with TS for leads.',
    chain: [
      block('tube-screamer', { drive: 1.5, tone: 6, level: 7.5 }),
      block('rectifier', {
        gain: 7.5,
        treble: 6.5,
        mid: 2.5,
        bass: 5,
        presence: 5.5,
        master: 3.5,
        channel: 'Modern',
      }),
      block('digital-delay', { time: 480, feedback: 25, mix: 15, highCut: 4 }),
      block('hall-reverb', { decay: 1.2, predelay: 20, mix: 12, damping: 6 }),
      block('4x12-v30', {
        mic: 'SM57',
        position: 2,
        distance: 1,
        lowCut: 95,
        highCut: 8500,
      }),
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'seed-ambient-wash',
    name: 'Ambient Wash',
    notes:
      'Shoegaze / ambient pad tone. Clean amp, heavy modulation, long delays into big reverb. Volume pedal swells work great. Keep drive off to preserve shimmer.',
    chain: [
      block('chorus', { rate: 0.4, depth: 6, mix: 45 }),
      block('flanger', { rate: 0.15, depth: 4, feedback: 3, manual: 6 }),
      block('twin-reverb', {
        volume: 3,
        treble: 5.5,
        middle: 5,
        bass: 5,
        reverb: 0,
        bright: true,
      }),
      block('tape-echo', { time: 520, feedback: 55, mix: 40, wow: 4 }),
      block('hall-reverb', { decay: 5.5, predelay: 60, mix: 45, damping: 3 }),
      block('2x12-blue', { mic: 'U87', position: 6, distance: 6, room: 5 }),
    ],
    createdAt: now,
    updatedAt: now,
  },
];
