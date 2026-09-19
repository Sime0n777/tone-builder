interface EmptyStateProps {
  onCreate: () => void;
}

export function EmptyState({ onCreate }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-card">
        <h2>Design &amp; play factory amp tones</h2>
        <p>
          Tone Builder is a web amp-sim workspace: pick a <strong>factory amp</strong> and{' '}
          <strong>cab</strong> from the library, build a pedal chain, and play through live
          interface input or synth preview. Algorithmic amp models (not neural captures) —
          no “capture your amp first” step.
        </p>
        <ol className="workflow">
          <li>
            <strong>Pick amp + cab</strong> — Deluxe Reverb, Twin, Plexi, Rectifier, AC30 +
            matching factory cabs
          </li>
          <li>
            <strong>Add pedals</strong> — drive → modulation → delay/reverb around the amp
          </li>
          <li>
            <strong>Play</strong> — live guitar via audio interface, or synth preview (updates
            as you turn knobs)
          </li>
          <li>
            <strong>Compare &amp; export</strong> — A/B two tones, copy recipe or JSON
          </li>
        </ol>
        <button type="button" className="btn primary large" onClick={onCreate}>
          Create your first tone
        </button>
      </div>
    </div>
  );
}
