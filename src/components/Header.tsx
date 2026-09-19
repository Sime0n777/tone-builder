interface HeaderProps {
  toneName: string | null;
  compareMode: boolean;
  canCompare: boolean;
  onToggleCompare: () => void;
  onResetSeeds: () => void;
}

export function Header({
  toneName,
  compareMode,
  canCompare,
  onToggleCompare,
  onResetSeeds,
}: HeaderProps) {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="logo" aria-hidden>
          <svg viewBox="0 0 32 32" width="28" height="28">
            <rect width="32" height="32" rx="6" fill="#161b22" />
            <path
              d="M8 22 L12 10 L16 18 L20 8 L24 22"
              stroke="#3dd68c"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx="12" cy="10" r="1.5" fill="#f0b429" />
            <circle cx="20" cy="8" r="1.5" fill="#f0b429" />
          </svg>
        </div>
        <div>
          <h1>Tone Builder</h1>
          <p className="tagline">Gear suite · NAM import · live input · tone design</p>
        </div>
      </div>
      <div className="header-center">
        {toneName && <span className="active-tone-name">{toneName}</span>}
      </div>
      <div className="header-actions">
        <button
          type="button"
          className={compareMode ? 'btn primary' : 'btn'}
          onClick={onToggleCompare}
          disabled={!canCompare}
          title={canCompare ? 'Compare two saved tones' : 'Need at least 2 tones'}
        >
          {compareMode ? 'Comparing…' : 'Compare A/B'}
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            if (confirm('Reset library to the example tones? Your custom presets will be replaced.')) {
              onResetSeeds();
            }
          }}
        >
          Reset examples
        </button>
      </div>
    </header>
  );
}
