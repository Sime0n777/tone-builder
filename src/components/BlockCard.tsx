import type { CSSProperties } from 'react';
import { getBlockType } from '../data/blockCatalog';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../types/tone';
import type { ChainBlock } from '../types/tone';
import { ParamControl } from './ParamControl';

interface BlockCardProps {
  block: ChainBlock;
  index: number;
  total: number;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onParamChange: (paramId: string, value: number | string | boolean) => void;
  readonly?: boolean;
}

export function BlockCard({
  block,
  index,
  total,
  onRemove,
  onMove,
  onParamChange,
  readonly = false,
}: BlockCardProps) {
  const def = getBlockType(block.typeId);
  if (!def) return null;

  const color = CATEGORY_COLORS[def.category];
  const isNam = def.typeId === 'nam-amp';
  const modelName = String(block.params.modelName ?? '(none)');
  const architecture = String(block.params.architecture ?? '—');

  const visibleParams = def.params.filter((param) => {
    if (!isNam) return true;
    // Hide raw modelId select; show level + slim. modelName/arch shown in banner.
    return param.id === 'level' || param.id === 'slimSize';
  });

  return (
    <article
      className={`block-card ${isNam ? 'nam-block' : ''}`}
      style={{ '--block-accent': color } as CSSProperties}
    >
      <header className="block-card-header">
        <div className="block-card-title">
          <span className="block-index">{index + 1}</span>
          <div>
            <h3>{isNam ? modelName || def.name : def.name}</h3>
            <span className="block-category">
              {isNam ? 'NAM Amp · Third-party' : CATEGORY_LABELS[def.category]}
            </span>
          </div>
        </div>
        {!readonly && (
          <div className="block-actions">
            <button
              type="button"
              className="icon-btn"
              disabled={index === 0}
              onClick={() => onMove(-1)}
              title="Move earlier in chain"
              aria-label="Move earlier"
            >
              ←
            </button>
            <button
              type="button"
              className="icon-btn"
              disabled={index === total - 1}
              onClick={() => onMove(1)}
              title="Move later in chain"
              aria-label="Move later"
            >
              →
            </button>
            <button
              type="button"
              className="icon-btn danger"
              onClick={onRemove}
              title="Remove block"
              aria-label="Remove block"
            >
              ×
            </button>
          </div>
        )}
      </header>
      <p className="block-desc">
        {isNam
          ? `Neural Amp Modeler · ${architecture} · ${def.description}`
          : def.description}
      </p>
      {isNam && (
        <div className="nam-meta-banner">
          <span>
            Model: <strong>{modelName}</strong>
          </span>
          <span className="muted">ID: {String(block.params.modelId || '—')}</span>
        </div>
      )}
      <div className="block-params">
        {visibleParams.map((param) => (
          <ParamControl
            key={param.id}
            param={param}
            value={block.params[param.id] ?? param.defaultValue}
            onChange={(v) => !readonly && onParamChange(param.id, v)}
            accent={color}
          />
        ))}
      </div>
    </article>
  );
}
