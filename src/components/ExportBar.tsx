import { useState } from 'react';
import type { TonePreset } from '../types/tone';
import { copyToClipboard, downloadJson, toneToRecipe } from '../utils/export';

interface ExportBarProps {
  preset: TonePreset;
}

export function ExportBar({ preset }: ExportBarProps) {
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const handleCopy = async () => {
    const ok = await copyToClipboard(toneToRecipe(preset));
    flash(ok ? 'Recipe copied' : 'Copy failed');
  };

  return (
    <div className="export-bar">
      <button type="button" className="btn" onClick={handleCopy}>
        Copy recipe
      </button>
      <button type="button" className="btn" onClick={() => downloadJson(preset)}>
        Download JSON
      </button>
      {toast && <span className="toast">{toast}</span>}
    </div>
  );
}
