interface EmptyStateProps {
  onCreate: () => void;
}

export function EmptyState({ onCreate }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-card">
        <h2>Design &amp; hear your guitar tone</h2>
        <p>
          Tone Builder is a practical workspace for planning signal chains — pedals, amp, and cab —
          with knobs, notes, A/B compare, export, and an approximate Web Audio preview so you can
          hear clean vs crunch vs high-gain differences.
        </p>
        <ol className="workflow">
          <li>
            <strong>Build a chain</strong> — drive → modulation → delay/reverb → amp → cab/IR
          </li>
          <li>
            <strong>Dial parameters</strong> — gain, EQ, presence, mix, time, feedback
          </li>
          <li>
            <strong>Press Play</strong> — live preview updates as you turn knobs (user gesture required)
          </li>
          <li>
            <strong>Compare &amp; export</strong> — A/B two tones (switch which you hear), copy recipe or JSON
          </li>
        </ol>
        <button type="button" className="btn primary large" onClick={onCreate}>
          Create your first tone
        </button>
      </div>
    </div>
  );
}
