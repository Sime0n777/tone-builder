interface NotesPanelProps {
  notes: string;
  onChange: (notes: string) => void;
  readonly?: boolean;
}

export function NotesPanel({ notes, onChange, readonly = false }: NotesPanelProps) {
  return (
    <section className="notes-panel">
      <div className="section-header">
        <h2>Tone Notes</h2>
      </div>
      <textarea
        className="notes-input"
        placeholder="Pickup, guitar, playing tips, room notes…"
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readonly}
        rows={5}
      />
    </section>
  );
}
