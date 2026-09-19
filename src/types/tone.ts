export type BlockCategory =
  | 'drive'
  | 'modulation'
  | 'delay'
  | 'reverb'
  | 'amp'
  | 'cab'
  | 'eq';

/** AmpliTube-style rig zones for the main board UI */
export type RigZone = 'pedalboard' | 'amp' | 'cab' | 'rack';

export type ParamType = 'knob' | 'slider' | 'toggle' | 'select';

export interface ParamDef {
  id: string;
  label: string;
  type: ParamType;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: string[];
  defaultValue: number | string | boolean;
}

export interface BlockTypeDef {
  typeId: string;
  name: string;
  category: BlockCategory;
  shortLabel: string;
  description: string;
  params: ParamDef[];
}

export interface ChainBlock {
  id: string;
  typeId: string;
  params: Record<string, number | string | boolean>;
}

export interface TonePreset {
  id: string;
  name: string;
  notes: string;
  chain: ChainBlock[];
  createdAt: string;
  updatedAt: string;
}

export interface AppState {
  presets: TonePreset[];
  activePresetId: string | null;
  comparePresetId: string | null;
  compareMode: boolean;
}

export const CATEGORY_ORDER: BlockCategory[] = [
  'drive',
  'eq',
  'modulation',
  'delay',
  'reverb',
  'amp',
  'cab',
];

export const CATEGORY_LABELS: Record<BlockCategory, string> = {
  drive: 'Stomp / Drive',
  eq: 'EQ',
  modulation: 'Modulation',
  delay: 'Delay',
  reverb: 'Reverb',
  amp: 'Amp',
  cab: 'Cab',
};

export const CATEGORY_COLORS: Record<BlockCategory, string> = {
  drive: '#e85d4c',
  eq: '#38bdf8',
  modulation: '#6c8cff',
  delay: '#3dd68c',
  reverb: '#a78bfa',
  amp: '#f0b429',
  cab: '#94a3b8',
};

export const RIG_ZONE_ORDER: RigZone[] = ['pedalboard', 'amp', 'cab', 'rack'];

export const RIG_ZONE_LABELS: Record<RigZone, string> = {
  pedalboard: 'Pedalboard',
  amp: 'Amp',
  cab: 'Cab',
  rack: 'Rack / FX',
};

export const RIG_ZONE_HINTS: Record<RigZone, string> = {
  pedalboard: 'Stomps ahead of the amp — OD, fuzz, boost, compressor, gate',
  amp: 'Factory algorithmic sims or imported NAM (.nam) models',
  cab: 'Speaker cabinet + mic placement',
  rack: 'Post-amp rack: EQ, modulation, delay, reverb',
};

/** Map block category → AmpliTube-like board zone */
export function categoryToZone(category: BlockCategory): RigZone {
  switch (category) {
    case 'drive':
      return 'pedalboard';
    case 'amp':
      return 'amp';
    case 'cab':
      return 'cab';
    case 'eq':
    case 'modulation':
    case 'delay':
    case 'reverb':
      return 'rack';
  }
}

/** Gear browser tabs (factory suite framing) */
export type GearSuiteTab = 'stomp' | 'amp' | 'cab' | 'rack' | 'nam';

export const GEAR_SUITE_TABS: { id: GearSuiteTab; label: string }[] = [
  { id: 'stomp', label: 'Stomp' },
  { id: 'amp', label: 'Amp' },
  { id: 'cab', label: 'Cab' },
  { id: 'rack', label: 'Rack' },
  { id: 'nam', label: 'NAM' },
];

export function categoriesForGearTab(tab: GearSuiteTab): BlockCategory[] {
  switch (tab) {
    case 'stomp':
      return ['drive'];
    case 'amp':
      return ['amp'];
    case 'cab':
      return ['cab'];
    case 'rack':
      return ['eq', 'modulation', 'delay', 'reverb'];
    case 'nam':
      return ['amp'];
  }
}
