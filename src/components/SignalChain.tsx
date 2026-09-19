import type { ChainBlock } from '../types/tone';
import { AddBlockMenu } from './AddBlockMenu';
import { BlockCard } from './BlockCard';
import { getBlockType } from '../data/blockCatalog';
import { CATEGORY_COLORS } from '../types/tone';

interface SignalChainProps {
  chain: ChainBlock[];
  onAdd: (typeId: string) => void;
  onRemove: (blockId: string) => void;
  onMove: (blockId: string, dir: -1 | 1) => void;
  onParamChange: (blockId: string, paramId: string, value: number | string | boolean) => void;
  readonly?: boolean;
  title?: string;
}

export function SignalChain({
  chain,
  onAdd,
  onRemove,
  onMove,
  onParamChange,
  readonly = false,
  title = 'Signal Chain',
}: SignalChainProps) {
  return (
    <section className="signal-chain">
      <div className="section-header">
        <h2>{title}</h2>
        <span className="muted">{chain.length} block{chain.length === 1 ? '' : 's'}</span>
      </div>

      {chain.length > 0 && (
        <div className="flow-strip" aria-hidden>
          <span className="flow-label">IN</span>
          {chain.map((b, i) => {
            const def = getBlockType(b.typeId);
            const color = def ? CATEGORY_COLORS[def.category] : '#666';
            return (
              <span key={b.id} className="flow-item">
                {i > 0 && <span className="flow-arrow">→</span>}
                <span className="flow-chip" style={{ borderColor: color, color }}>
                  {def?.shortLabel ?? '?'}
                </span>
              </span>
            );
          })}
          <span className="flow-arrow">→</span>
          <span className="flow-label out">OUT</span>
        </div>
      )}

      {!readonly && <AddBlockMenu onAdd={onAdd} />}

      {chain.length === 0 ? (
        <div className="chain-empty">
          <p>No blocks yet. Add pedals, amp, and cab to shape your tone.</p>
          <p className="muted">Typical order: Drive → Modulation → Delay/Reverb → Amp → Cab</p>
        </div>
      ) : (
        <div className="chain-list">
          {chain.map((block, index) => (
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
    </section>
  );
}
