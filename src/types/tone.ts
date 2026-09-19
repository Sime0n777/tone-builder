export type BlockCategory =
  | 'drive'
  | 'modulation'
  | 'delay'
  | 'reverb'
  | 'amp'
  | 'cab';

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
  'modulation',
  'delay',
  'reverb',
  'amp',
  'cab',
];

export const CATEGORY_LABELS: Record<BlockCategory, string> = {
  drive: 'Drive / OD',
  modulation: 'Modulation',
  delay: 'Delay',
  reverb: 'Reverb',
  amp: 'Factory Amp',
  cab: 'Factory Cab',
};

export const CATEGORY_COLORS: Record<BlockCategory, string> = {
  drive: '#e85d4c',
  modulation: '#6c8cff',
  delay: '#3dd68c',
  reverb: '#a78bfa',
  amp: '#f0b429',
  cab: '#94a3b8',
};
