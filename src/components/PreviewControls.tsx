import type { PreviewNote } from '../audio/ToneEngine';

const NOTES: { id: PreviewNote; label: string }[] = [
  { id: 'E2', label: 'E2' },
  { id: 'A2', label: 'A2' },
  { id: 'D3', label: 'D3' },
  { id: 'G3', label: 'G3' },
  { id: 'B3', label: 'B3' },
  { id: 'E4', label: 'E4' },
];

interface PreviewControlsProps {
  playing: boolean;
  note: PreviewNote;
  onToggle: () => void;
  onStop: () => void;
  onNoteChange: (note: PreviewNote) => void;
  compareMode?: boolean;
  audibleId?: 'A' | 'B';
  onAudibleChange?: (which: 'A' | 'B') => void;
  disabled?: boolean;
}

export function PreviewControls({
  playing,
  note,
  onToggle,
  onStop,
  onNoteChange,
  compareMode,
  audibleId = 'A',
  onAudibleChange,
  disabled,
}: PreviewControlsProps) {
  return (
    <div className={`preview-controls ${playing ? 'live' : ''}`}>
      <div className="preview-main">
        <button
          type="button"
          className={`btn play-btn ${playing ? 'playing' : 'primary'}`}
          onClick={onToggle}
          disabled={disabled}
          aria-pressed={playing}
        >
          {playing ? (
            <>
              <span className="pulse-dot" /> Stop preview
            </>
          ) : (
            <>▶ Play tone</>
          )}
        </button>
        {playing && (
          <button type="button" className="btn ghost" onClick={onStop}>
            Silence
          </button>
        )}
      </div>

      <label className="note-select">
        <span>Note</span>
        <select
          value={note}
          onChange={(e) => onNoteChange(e.target.value as PreviewNote)}
          disabled={disabled}
        >
          {NOTES.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label}
            </option>
          ))}
        </select>
      </label>

      {compareMode && onAudibleChange && (
        <div className="ab-audio" role="group" aria-label="Audible tone">
          <span className="ab-label">Hear</span>
          <button
            type="button"
            className={audibleId === 'A' ? 'chip active' : 'chip'}
            onClick={() => onAudibleChange('A')}
          >
            A
          </button>
          <button
            type="button"
            className={audibleId === 'B' ? 'chip active' : 'chip'}
            onClick={() => onAudibleChange('B')}
          >
            B
          </button>
        </div>
      )}

      <p className="preview-hint muted">
        Approximate Web Audio preview — gated by Play (browser autoplay policy). Not a full amp sim.
      </p>
    </div>
  );
}
