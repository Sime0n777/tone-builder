import { useState } from 'react';
import type { TonePreset } from '../types/tone';

interface ToneLibraryProps {
  presets: TonePreset[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ToneLibrary({
  presets,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
}: ToneLibraryProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const startRename = (p: TonePreset) => {
    setEditingId(p.id);
    setEditName(p.name);
  };

  const commitRename = () => {
    if (editingId && editName.trim()) {
      onRename(editingId, editName.trim());
    }
    setEditingId(null);
  };

  return (
    <aside className="library">
      <div className="section-header">
        <h2>Tone Library</h2>
        <button type="button" className="btn small primary" onClick={onCreate}>
          + New
        </button>
      </div>
      <ul className="preset-list">
        {presets.map((p) => (
          <li key={p.id} className={p.id === activeId ? 'preset active' : 'preset'}>
            <button type="button" className="preset-select" onClick={() => onSelect(p.id)}>
              {editingId === p.id ? (
                <input
                  className="rename-input"
                  value={editName}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
              ) : (
                <>
                  <span className="preset-name">{p.name}</span>
                  <span className="preset-meta">
                    {p.chain.length} blocks
                    {p.notes ? ' · notes' : ''}
                  </span>
                </>
              )}
            </button>
            <div className="preset-actions">
              <button
                type="button"
                className="icon-btn"
                title="Rename"
                onClick={() => startRename(p)}
              >
                ✎
              </button>
              <button
                type="button"
                className="icon-btn"
                title="Duplicate"
                onClick={() => onDuplicate(p.id)}
              >
                ⧉
              </button>
              <button
                type="button"
                className="icon-btn danger"
                title="Delete"
                onClick={() => {
                  if (presets.length <= 1) return;
                  if (confirm(`Delete “${p.name}”?`)) onDelete(p.id);
                }}
                disabled={presets.length <= 1}
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
