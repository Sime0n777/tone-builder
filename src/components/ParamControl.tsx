import type { ParamDef } from '../types/tone';
import { Knob } from './Knob';

interface ParamControlProps {
  param: ParamDef;
  value: number | string | boolean;
  onChange: (value: number | string | boolean) => void;
  accent?: string;
}

export function ParamControl({ param, value, onChange, accent }: ParamControlProps) {
  if (param.type === 'knob') {
    return (
      <Knob
        label={param.label}
        value={Number(value)}
        min={param.min ?? 0}
        max={param.max ?? 10}
        step={param.step ?? 0.1}
        unit={param.unit}
        onChange={onChange}
        accent={accent}
      />
    );
  }

  if (param.type === 'slider') {
    return (
      <label className="slider-control">
        <div className="slider-header">
          <span>{param.label}</span>
          <span className="slider-value">
            {typeof value === 'number' && !Number.isInteger(value)
              ? value.toFixed(1)
              : String(value)}
            {param.unit ?? ''}
          </span>
        </div>
        <input
          type="range"
          min={param.min}
          max={param.max}
          step={param.step}
          value={Number(value)}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ accentColor: accent }}
        />
      </label>
    );
  }

  if (param.type === 'toggle') {
    return (
      <label className="toggle-control">
        <span>{param.label}</span>
        <button
          type="button"
          className={`toggle-btn ${value ? 'on' : ''}`}
          onClick={() => onChange(!value)}
          aria-pressed={Boolean(value)}
        >
          {value ? 'On' : 'Off'}
        </button>
      </label>
    );
  }

  if (param.type === 'select' && param.options) {
    return (
      <label className="select-control">
        <span>{param.label}</span>
        <select value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {param.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return null;
}
