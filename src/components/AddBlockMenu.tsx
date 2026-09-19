import { useMemo, useState } from 'react';
import { BLOCK_CATALOG } from '../data/blockCatalog';
import { CATEGORY_COLORS, CATEGORY_LABELS, CATEGORY_ORDER } from '../types/tone';
import type { BlockCategory } from '../types/tone';

interface AddBlockMenuProps {
  onAdd: (typeId: string) => void;
}

export function AddBlockMenu({ onAdd }: AddBlockMenuProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<BlockCategory | 'all'>('all');

  const grouped = useMemo(() => {
    const cats = filter === 'all' ? CATEGORY_ORDER : [filter];
    return cats.map((cat) => ({
      category: cat,
      blocks: BLOCK_CATALOG.filter((b) => b.category === cat),
    }));
  }, [filter]);

  return (
    <div className="add-block">
      <button type="button" className="btn primary" onClick={() => setOpen((o) => !o)}>
        {open ? 'Close catalog' : '+ Add block'}
      </button>
      {open && (
        <div className="add-block-panel">
          <div className="category-filters">
            <button
              type="button"
              className={filter === 'all' ? 'chip active' : 'chip'}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            {CATEGORY_ORDER.map((cat) => (
              <button
                key={cat}
                type="button"
                className={filter === cat ? 'chip active' : 'chip'}
                style={
                  filter === cat
                    ? { borderColor: CATEGORY_COLORS[cat], color: CATEGORY_COLORS[cat] }
                    : undefined
                }
                onClick={() => setFilter(cat)}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
          <div className="catalog-grid">
            {grouped.map(({ category, blocks }) =>
              blocks.map((b) => (
                <button
                  key={b.typeId}
                  type="button"
                  className="catalog-item"
                  style={{ borderLeftColor: CATEGORY_COLORS[category] }}
                  onClick={() => {
                    onAdd(b.typeId);
                    setOpen(false);
                  }}
                >
                  <span className="catalog-short" style={{ color: CATEGORY_COLORS[category] }}>
                    {b.shortLabel}
                  </span>
                  <span className="catalog-name">{b.name}</span>
                  <span className="catalog-desc">{b.description}</span>
                </button>
              )),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
