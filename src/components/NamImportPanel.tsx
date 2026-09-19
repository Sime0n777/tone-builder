import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import {
  deleteNamModel,
  importNamFromFile,
  listNamModels,
  type NamLibraryEntry,
} from '../audio/namLibrary';
import { isToneXFilename, NamImportError } from '../audio/namParse';

interface NamImportPanelProps {
  onUseModel: (entry: NamLibraryEntry) => void;
  compact?: boolean;
}

export function NamImportPanel({ onUseModel, compact = false }: NamImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [models, setModels] = useState<NamLibraryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setModels(await listNamModels());
    } catch {
      setModels([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const ingestFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (!list.length) return;
      setBusy(true);
      setError(null);
      try {
        for (const file of list) {
          if (isToneXFilename(file.name)) {
            throw new NamImportError(
              'ToneX (.tnx) models are not supported. Use a Neural Amp Modeler (.nam) file (e.g. from ToneHunt).',
            );
          }
          const entry = await importNamFromFile(file);
          setModels((prev) => [entry, ...prev.filter((m) => m.id !== entry.id)]);
          onUseModel(entry);
        }
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Import failed');
      } finally {
        setBusy(false);
      }
    },
    [onUseModel, refresh],
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (e.dataTransfer.files?.length) void ingestFiles(e.dataTransfer.files);
    },
    [ingestFiles],
  );

  return (
    <div className={`nam-import ${compact ? 'compact' : ''} ${dragOver ? 'drag-over' : ''}`}>
      <div
        className="nam-dropzone"
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <div className="nam-drop-copy">
          <strong>Third-party models</strong>
          <p className="muted">
            Drop <code>.nam</code> files here (ToneHunt / NAM). ToneX <code>.tnx</code> is not
            supported.
          </p>
        </div>
        <div className="nam-drop-actions">
          <button
            type="button"
            className="btn primary small"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? 'Importing…' : 'Import .nam'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".nam,application/json"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) void ingestFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {error && <p className="preview-error">{error}</p>}

      {models.length > 0 && (
        <ul className="nam-model-list">
          {models.map((m) => (
            <li key={m.id} className="nam-model-row">
              <button type="button" className="nam-model-select" onClick={() => onUseModel(m)}>
                <span className="nam-model-name">{m.displayName}</span>
                <span className="muted">
                  {m.architecture} · {(m.sizeBytes / 1024).toFixed(0)} KB · {m.sampleRate} Hz
                </span>
              </button>
              <button
                type="button"
                className="icon-btn danger"
                title="Remove from library"
                aria-label="Remove model"
                onClick={() => {
                  void deleteNamModel(m.id).then(refresh);
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
