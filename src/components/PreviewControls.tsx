import type { PreviewNote, SourceMode } from '../audio/ToneEngine';

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
  sourceMode: SourceMode;
  onSourceModeChange: (mode: SourceMode) => void;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string;
  onDeviceChange: (deviceId: string) => void;
  onRefreshDevices: () => void;
  onStartLive: () => void;
  inputLevel: number;
  inputError: string | null;
  permissionGranted: boolean;
}

function deviceLabel(d: MediaDeviceInfo, index: number): string {
  if (d.label) return d.label;
  return `Audio input ${index + 1}`;
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
  sourceMode,
  onSourceModeChange,
  devices,
  selectedDeviceId,
  onDeviceChange,
  onRefreshDevices,
  onStartLive,
  inputLevel,
  inputError,
  permissionGranted,
}: PreviewControlsProps) {
  const isLive = sourceMode === 'live';
  const meterPct = Math.round(Math.min(1, inputLevel) * 100);

  return (
    <div className={`preview-controls ${playing ? 'live' : ''}`}>
      <div className="source-mode" role="group" aria-label="Input source">
        <span className="source-mode-label">Source</span>
        <button
          type="button"
          className={!isLive ? 'chip active' : 'chip'}
          onClick={() => onSourceModeChange('synth')}
          disabled={disabled}
        >
          Synth preview
        </button>
        <button
          type="button"
          className={isLive ? 'chip active' : 'chip'}
          onClick={() => onSourceModeChange('live')}
          disabled={disabled}
        >
          Live input
        </button>
      </div>

      <div className="preview-main">
        {isLive ? (
          <>
            <button
              type="button"
              className={`btn play-btn ${playing ? 'playing' : 'primary'}`}
              onClick={() => {
                if (playing) onStop();
                else onStartLive();
              }}
              disabled={disabled}
              aria-pressed={playing}
            >
              {playing ? (
                <>
                  <span className="pulse-dot" /> Stop monitoring
                </>
              ) : (
                <>🎙 Enable input / Start monitoring</>
              )}
            </button>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      {!isLive && (
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
      )}

      {isLive && (
        <div className="live-input-row">
          <label className="note-select device-select">
            <span>Input</span>
            <select
              value={selectedDeviceId}
              onChange={(e) => onDeviceChange(e.target.value)}
              disabled={disabled || (devices.length === 0 && !permissionGranted)}
            >
              {devices.length === 0 ? (
                <option value="">No devices — enable input first</option>
              ) : (
                devices.map((d, i) => (
                  <option key={d.deviceId || `dev-${i}`} value={d.deviceId}>
                    {deviceLabel(d, i)}
                  </option>
                ))
              )}
            </select>
          </label>
          <button
            type="button"
            className="btn ghost small"
            onClick={onRefreshDevices}
            disabled={disabled}
            title="Refresh input devices"
          >
            Refresh
          </button>
          {playing && (
            <div
              className="input-meter"
              title="Input level"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={meterPct}
              aria-label="Input level"
            >
              <span className="input-meter-label">In</span>
              <div className="input-meter-track">
                <div
                  className={`input-meter-fill ${meterPct > 85 ? 'hot' : ''}`}
                  style={{ width: `${meterPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

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

      {inputError && (
        <p className="preview-error" role="alert">
          {inputError}
        </p>
      )}

      <p className="preview-hint muted">
        {isLive ? (
          <>
            Live guitar via your audio interface. Browser processing (echo cancellation /
            noise suppression / AGC) is disabled. Use <strong>headphones</strong> or
            interface direct monitoring to avoid feedback / latency loops. Requires
            localhost or HTTPS.
          </>
        ) : (
          <>
            Approximate Web Audio preview — gated by Play (browser autoplay policy). Not a
            full amp sim.
          </>
        )}
      </p>
    </div>
  );
}
