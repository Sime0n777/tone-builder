import { useMemo, useState } from 'react';
import { BLOCK_CATALOG } from '../data/blockCatalog';
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  GEAR_SUITE_TABS,
  categoriesForGearTab,
  type GearSuiteTab,
} from '../types/tone';
import { NamImportPanel } from './NamImportPanel';
import type { NamLibraryEntry } from '../audio/namLibrary';

interface GearBrowserProps {
  onAdd: (typeId: string) => void;
  onAddNam: (entry: NamLibraryEntry) => void;
}

export function GearBrowser({ onAdd, onAddNam }: GearBrowserProps) {
  const [tab, setTab] = useState<GearSuiteTab>('amp');
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    if (tab === 'nam') return [];
    const cats = new Set(categoriesForGearTab(tab));
    const q = query.trim().toLowerCase();
    return BLOCK_CATALOG.filter((b) => {
      if (b.typeId === 'nam-amp') return false;
      if (!cats.has(b.category)) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.shortLabel.toLowerCase().includes(q)
      );
    });
  }, [tab, query]);

  return (
    <section className="gear-browser">
      <div className="section-header">
        <h2>Gear Suite</h2>
        <span className="muted">Factory library · AmpliTube-style picker</span>
      </div>

      <div className="gear-tabs" role="tablist" aria-label="Gear categories">
        {GEAR_SUITE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'gear-tab active' : 'gear-tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab !== 'nam' && (
        <div className="gear-search">
          <input
            type="search"
            placeholder={`Search ${tab}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search gear"
          />
        </div>
      )}

      {tab === 'nam' ? (
        <NamImportPanel onUseModel={onAddNam} />
      ) : (
        <div className="catalog-grid gear-grid">
          {items.map((b) => (
            <button
              key={b.typeId}
              type="button"
              className="catalog-item"
              style={{ borderLeftColor: CATEGORY_COLORS[b.category] }}
              onClick={() => onAdd(b.typeId)}
            >
              <span className="catalog-short" style={{ color: CATEGORY_COLORS[b.category] }}>
                {b.shortLabel}
              </span>
              <span className="catalog-name">{b.name}</span>
              <span className="catalog-desc">{b.description}</span>
              <span className="catalog-cat muted">{CATEGORY_LABELS[b.category]}</span>
            </button>
          ))}
          {items.length === 0 && <p className="muted">No gear matches that search.</p>}
        </div>
      )}
    </section>
  );
}
