/**
 * NAM (.nam) file ingest helpers.
 * ToneX / .tnx is intentionally unsupported — do not attempt to parse it.
 */

export interface NamMetadata {
  name?: string;
  modeled_by?: string;
  gear_make?: string;
  gear_model?: string;
  gear_type?: string;
  tone_type?: string;
  [key: string]: unknown;
}

export interface ParsedNamModel {
  /** Original JSON text for wasm loadModel() */
  json: string;
  version: string;
  architecture: string;
  sampleRate: number;
  metadata: NamMetadata;
  displayName: string;
  weightCount: number;
}

export class NamImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NamImportError';
  }
}

const TONEX_EXTS = ['.tnx', '.tonex'];

export function isToneXFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return TONEX_EXTS.some((ext) => lower.endsWith(ext));
}

export function isNamFilename(filename: string): boolean {
  return filename.toLowerCase().endsWith('.nam');
}

/**
 * Parse a .nam file (JSON) into a structured model record.
 * Rejects ToneX / non-NAM payloads with a clear error.
 */
export function parseNamFile(filename: string, text: string): ParsedNamModel {
  if (isToneXFilename(filename)) {
    throw new NamImportError(
      'ToneX (.tnx) models are not supported. Export or download a Neural Amp Modeler (.nam) file instead (e.g. from ToneHunt).',
    );
  }

  if (!isNamFilename(filename) && !looksLikeNamJson(text)) {
    throw new NamImportError(
      'Unrecognized file. Tone Builder imports Neural Amp Modeler (.nam) models only — not ToneX.',
    );
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new NamImportError('Could not parse file as JSON. A valid .nam model is required.');
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new NamImportError('Invalid NAM file: expected a JSON object.');
  }

  const obj = data as Record<string, unknown>;

  if (!('architecture' in obj) || !('weights' in obj) || !('config' in obj)) {
    throw new NamImportError(
      'This does not look like a NAM model (missing architecture / config / weights). ToneX files are not supported.',
    );
  }

  const architecture = String(obj.architecture ?? 'Unknown');
  const version = String(obj.version ?? '0.0.0');
  const sampleRate =
    typeof obj.sample_rate === 'number' && obj.sample_rate > 0 ? obj.sample_rate : 48000;
  const metadata =
    obj.metadata && typeof obj.metadata === 'object' && !Array.isArray(obj.metadata)
      ? (obj.metadata as NamMetadata)
      : {};
  const weights = obj.weights;
  const weightCount = Array.isArray(weights) ? weights.length : 0;

  if (weightCount < 1) {
    throw new NamImportError('NAM model has no weights.');
  }

  const fromMeta =
    (typeof metadata.name === 'string' && metadata.name.trim()) ||
    [metadata.gear_make, metadata.gear_model].filter(Boolean).join(' ').trim();
  const baseName = filename.replace(/\.nam$/i, '').trim();
  const displayName = fromMeta || baseName || 'Imported NAM';

  return {
    json: text,
    version,
    architecture,
    sampleRate,
    metadata,
    displayName,
    weightCount,
  };
}

function looksLikeNamJson(text: string): boolean {
  const head = text.slice(0, 400);
  return (
    head.includes('"architecture"') &&
    head.includes('"weights"') &&
    (head.includes('"WaveNet"') || head.includes('"LSTM"') || head.includes('"config"'))
  );
}
