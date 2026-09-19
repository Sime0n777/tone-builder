import { useCallback, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  accent?: string;
}

export function Knob({
  label,
  value,
  min,
  max,
  step = 0.1,
  unit,
  onChange,
  accent = '#3dd68c',
}: KnobProps) {
  const dragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(0);

  const pct = ((value - min) / (max - min)) * 100;
  const rotation = -135 + (pct / 100) * 270;

  const clamp = useCallback(
    (v: number) => {
      const stepped = Math.round(v / step) * step;
      return Math.min(max, Math.max(min, Number(stepped.toFixed(4))));
    },
    [min, max, step],
  );

  const onPointerDown = (e: PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    startY.current = e.clientY;
    startVal.current = value;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging.current) return;
    const delta = (startY.current - e.clientY) * ((max - min) / 120);
    onChange(clamp(startVal.current + delta));
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  const display =
    Number.isInteger(step) || step >= 1
      ? Math.round(value).toString()
      : value.toFixed(1);

  const style = {
    '--accent': accent,
    '--pct': pct,
  } as CSSProperties;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') onChange(clamp(value + step));
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') onChange(clamp(value - step));
  };

  return (
    <div className="knob-wrap">
      <div
        className="knob"
        style={style}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <div className="knob-ring" />
        <div className="knob-dial" style={{ transform: `rotate(${rotation}deg)` }}>
          <span className="knob-indicator" />
        </div>
        <div className="knob-value">
          {display}
          {unit ? <span className="knob-unit">{unit}</span> : null}
        </div>
      </div>
      <span className="knob-label">{label}</span>
    </div>
  );
}
