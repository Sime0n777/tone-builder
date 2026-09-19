import { getBlockType } from '../data/blockCatalog';
import { CATEGORY_LABELS } from '../types/tone';
import type { TonePreset, ChainBlock } from '../types/tone';

function formatParamValue(value: number | string | boolean, unit?: string): string {
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (typeof value === 'number') {
    const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1);
    return unit ? `${rounded}${unit}` : rounded;
  }
  return String(value);
}

function formatBlock(block: ChainBlock, index: number): string {
  const def = getBlockType(block.typeId);
  const name = def?.name ?? block.typeId;
  const category = def ? CATEGORY_LABELS[def.category] : 'Unknown';
  const lines = [`  ${index + 1}. [${category}] ${name}`];
  if (def) {
    for (const p of def.params) {
      const val = block.params[p.id] ?? p.defaultValue;
      lines.push(`     • ${p.label}: ${formatParamValue(val, p.unit)}`);
    }
  }
  return lines.join('\n');
}

export function toneToRecipe(preset: TonePreset): string {
  const header = [
    `═══════════════════════════════════════`,
    `  TONE BUILDER RECIPE`,
    `═══════════════════════════════════════`,
    ``,
    `Name: ${preset.name}`,
    `Updated: ${new Date(preset.updatedAt).toLocaleString()}`,
    ``,
  ];

  if (preset.notes.trim()) {
    header.push(`Notes:`, preset.notes.trim(), ``);
  }

  header.push(`Signal Chain (${preset.chain.length} blocks):`, ``);

  if (preset.chain.length === 0) {
    header.push(`  (empty chain)`);
  } else {
    preset.chain.forEach((b, i) => header.push(formatBlock(b, i), ``));
  }

  header.push(`───────────────────────────────────────`, `Exported from Tone Builder`, ``);
  return header.join('\n');
}

export function toneToJson(preset: TonePreset): string {
  return JSON.stringify(preset, null, 2);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadJson(preset: TonePreset): void {
  const blob = new Blob([toneToJson(preset)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${preset.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'tone'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
