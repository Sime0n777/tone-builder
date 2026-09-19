import type { TonePreset } from '../types/tone';
import { getBlockType } from '../data/blockCatalog';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../types/tone';

interface CompareViewProps {
  toneA: TonePreset;
  toneB: TonePreset;
  presets: TonePreset[];
  onSelectB: (id: string) => void;
  onExit: () => void;
  audibleId?: 'A' | 'B';
  onAudibleChange?: (which: 'A' | 'B') => void;
}

function ChainSummary({ preset }: { preset: TonePreset }) {
  if (preset.chain.length === 0) {
    return <p className="muted">Empty chain</p>;
  }
  return (
    <ol className="compare-chain">
      {preset.chain.map((block, i) => {
        const def = getBlockType(block.typeId);
        const color = def ? CATEGORY_COLORS[def.category] : '#666';
        return (
          <li key={block.id} className="compare-block">
            <div className="compare-block-head" style={{ borderLeftColor: color }}>
              <strong>
                {i + 1}. {def?.name ?? block.typeId}
              </strong>
              <span className="muted">{def ? CATEGORY_LABELS[def.category] : ''}</span>
            </div>
            <ul className="compare-params">
              {def?.params.map((p) => (
                <li key={p.id}>
                  <span>{p.label}</span>
                  <span>
                    {typeof block.params[p.id] === 'boolean'
                      ? block.params[p.id]
                        ? 'On'
                        : 'Off'
                      : String(block.params[p.id] ?? p.defaultValue)}
                    {p.unit && typeof block.params[p.id] === 'number' ? p.unit : ''}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

export function CompareView({
  toneA,
  toneB,
  presets,
  onSelectB,
  onExit,
  audibleId = 'A',
  onAudibleChange,
}: CompareViewProps) {
  return (
    <section className="compare-view">
      <div className="section-header">
        <h2>Compare Mode</h2>
        <button type="button" className="btn" onClick={onExit}>
          Exit compare
        </button>
      </div>

      {onAudibleChange && (
        <div className="compare-hear-bar">
          <span>Now hearing:</span>
          <button
            type="button"
            className={audibleId === 'A' ? 'btn primary small' : 'btn small'}
            onClick={() => onAudibleChange('A')}
          >
            Tone A — {toneA.name}
          </button>
          <button
            type="button"
            className={audibleId === 'B' ? 'btn primary small' : 'btn small'}
            onClick={() => onAudibleChange('B')}
          >
            Tone B — {toneB.name}
          </button>
        </div>
      )}

      <div className="compare-grid">
        <div className={`compare-col ${audibleId === 'A' ? 'hearing' : ''}`}>
          <div className="compare-label">A — Active{audibleId === 'A' ? ' · ▶' : ''}</div>
          <h3>{toneA.name}</h3>
          {toneA.notes && <p className="compare-notes">{toneA.notes}</p>}
          <ChainSummary preset={toneA} />
        </div>
        <div className={`compare-col ${audibleId === 'B' ? 'hearing' : ''}`}>
          <div className="compare-label row">
            <span>B — Compare{audibleId === 'B' ? ' · ▶' : ''}</span>
            <select
              value={toneB.id}
              onChange={(e) => onSelectB(e.target.value)}
              aria-label="Select tone B"
            >
              {presets
                .filter((p) => p.id !== toneA.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
          <h3>{toneB.name}</h3>
          {toneB.notes && <p className="compare-notes">{toneB.notes}</p>}
          <ChainSummary preset={toneB} />
        </div>
      </div>
    </section>
  );
}
