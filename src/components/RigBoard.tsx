import { useMemo, useState } from 'react';
import { getBlockType } from '../data/blockCatalog';
import type { NamLibraryEntry } from '../audio/namLibrary';
import {
  CATEGORY_COLORS,
  RIG_ZONE_HINTS,
  RIG_ZONE_LABELS,
  RIG_ZONE_ORDER,
  categoryToZone,
  type ChainBlock,
  type RigZone,
} from '../types/tone';
import { BlockCard } from './BlockCard';
import { GearBrowser } from './GearBrowser';
import { NamImportPanel } from './NamImportPanel';

interface RigBoardProps {
  chain: ChainBlock[];
  onAdd: (typeId: string) => void;
  onAddNam: (entry: NamLibraryEntry) => void;
  onRemove: (blockId: string) => void;
  onMove: (blockId: string, dir: -1 | 1) => void;
  onParamChange: (blockId: string, paramId: string, value: number | string | boolean) => void;
  readonly?: boolean;
  namStatus?: { ok: boolean; message: string; fallback: boolean } | null;
}

export function RigBoard({
  chain,
  onAdd,
  onAddNam,
  onRemove,
  onMove,
  onParamChange,
  readonly = false,
  namStatus,
}: RigBoardProps) {
  const [showBrowser, setShowBrowser] = useState(true);

  const zones = useMemo(() => {
    const map: Record<RigZone, { block: ChainBlock; index: number }[]> = {
      pedalboard: [],
      amp: [],
      cab: [],
      rack: [],
    };
    chain.forEach((block, index) => {
      const def = getBlockType(block.typeId);
      if (!def) return;
      map[categoryToZone(def.category)].push({ block, index });
    });
    return map;
  }, [chain]);

  return (
    <section className="rig-board">
      <div className="section-header">
        <h2>Signal Rig</h2>
        <span className="muted">
          Pedalboard → Amp → Cab → Rack · {chain.length} block{chain.length === 1 ? '' : 's'}
        </span>
      </div>

      {chain.length > 0 && (
        <div className="flow-strip rig-flow" aria-hidden>
          <span className="flow-label">IN</span>
          {RIG_ZONE_ORDER.map((zone) => {
            const items = zones[zone];
            if (!items.length) return null;
            return (
              <span key={zone} className="flow-zone-group">
                <span className="flow-arrow">→</span>
                <span className={`flow-zone-label zone-${zone}`}>{RIG_ZONE_LABELS[zone]}</span>
                {items.map(({ block }) => {
                  const def = getBlockType(block.typeId);
                  const color = def ? CATEGORY_COLORS[def.category] : '#666';
                  return (
                    <span
                      key={block.id}
                      className="flow-chip"
                      style={{ borderColor: color, color }}
                    >
                      {def?.shortLabel ?? '?'}
                    </span>
                  );
                })}
              </span>
            );
          })}
          <span className="flow-arrow">→</span>
          <span className="flow-label out">OUT</span>
        </div>
      )}

      {!readonly && (
        <div className="rig-toolbar">
          <button
            type="button"
            className={showBrowser ? 'btn primary' : 'btn'}
            onClick={() => setShowBrowser((v) => !v)}
          >
            {showBrowser ? 'Hide gear suite' : 'Open gear suite'}
          </button>
        </div>
      )}

      {!readonly && showBrowser && <GearBrowser onAdd={onAdd} onAddNam={onAddNam} />}

      {namStatus && (
        <p className={namStatus.ok ? 'nam-status ok' : 'nam-status warn'}>
          {namStatus.message}
          {namStatus.fallback ? ' · Running algorithmic fallback while NAM identity is shown.' : ''}
        </p>
      )}

      <div className="rig-zones">
        {RIG_ZONE_ORDER.map((zone) => (
          <div key={zone} className={`rig-zone zone-${zone}`}>
            <header className="rig-zone-header">
              <div>
                <h3>{RIG_ZONE_LABELS[zone]}</h3>
                <p className="muted">{RIG_ZONE_HINTS[zone]}</p>
              </div>
              <span className="rig-zone-count">{zones[zone].length}</span>
            </header>

            {zone === 'amp' && !readonly && (
              <NamImportPanel
                compact
                onUseModel={(entry) => {
                  onAddNam(entry);
                }}
              />
            )}

            {zones[zone].length === 0 ? (
              <div className="rig-zone-empty">
                <p className="muted">Empty — add gear from the suite above.</p>
              </div>
            ) : (
              <div className="chain-list zone-list">
                {zones[zone].map(({ block, index }) => (
                  <BlockCard
                    key={block.id}
                    block={block}
                    index={index}
                    total={chain.length}
                    onRemove={() => onRemove(block.id)}
                    onMove={(dir) => onMove(block.id, dir)}
                    onParamChange={(paramId, value) => onParamChange(block.id, paramId, value)}
                    readonly={readonly}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
