import { useEffect, useState } from 'react';
import { CompareView } from './components/CompareView';
import { EmptyState } from './components/EmptyState';
import { ExportBar } from './components/ExportBar';
import { Header } from './components/Header';
import { NotesPanel } from './components/NotesPanel';
import { PreviewControls } from './components/PreviewControls';
import { RigBoard } from './components/RigBoard';
import { ToneLibrary } from './components/ToneLibrary';
import { useTonePreview } from './hooks/useTonePreview';
import { useToneStore } from './hooks/useToneStore';

export default function App() {
  const store = useToneStore();
  const preview = useTonePreview();
  const [namStatus, setNamStatus] = useState<{
    ok: boolean;
    message: string;
    fallback: boolean;
  } | null>(null);

  useEffect(() => {
    preview.syncPresets(store.activePreset, store.comparePreset, store.compareMode);
  }, [
    store.activePreset,
    store.comparePreset,
    store.compareMode,
    preview.syncPresets,
  ]);

  useEffect(() => {
    if (!preview.playing) return;
    const id = window.setInterval(() => {
      setNamStatus(preview.getNamStatus());
    }, 400);
    return () => window.clearInterval(id);
  }, [preview.playing, preview.getNamStatus]);

  const canCompare = store.presets.length >= 2;

  const handleToggleCompare = () => {
    if (store.compareMode) {
      store.setCompareMode(false);
      return;
    }
    if (!canCompare || !store.activePreset) return;
    const other =
      store.comparePreset && store.comparePreset.id !== store.activePreset.id
        ? store.comparePreset.id
        : store.presets.find((p) => p.id !== store.activePreset!.id)?.id;
    if (other) store.setComparePresetId(other);
    store.setCompareMode(true);
  };

  return (
    <div className="app">
      <Header
        toneName={store.activePreset?.name ?? null}
        compareMode={store.compareMode}
        canCompare={canCompare}
        onToggleCompare={handleToggleCompare}
        onResetSeeds={store.resetToSeeds}
      />

      {store.presets.length === 0 || !store.activePreset ? (
        <EmptyState onCreate={() => store.createPreset()} />
      ) : (
        <div className="workspace">
          <ToneLibrary
            presets={store.presets}
            activeId={store.activePreset.id}
            onSelect={store.selectPreset}
            onCreate={() => store.createPreset()}
            onRename={store.renamePreset}
            onDuplicate={store.duplicatePreset}
            onDelete={store.deletePreset}
          />

          <main className="main-panel">
            <PreviewControls
              playing={preview.playing}
              note={preview.note}
              onToggle={() => void preview.toggle()}
              onStop={preview.stop}
              onNoteChange={preview.setNote}
              compareMode={store.compareMode}
              audibleId={preview.audibleId}
              onAudibleChange={(w) => void preview.setAudible(w)}
              sourceMode={preview.sourceMode}
              onSourceModeChange={preview.setSourceMode}
              devices={preview.devices}
              selectedDeviceId={preview.selectedDeviceId}
              onDeviceChange={preview.setDeviceId}
              onRefreshDevices={() => void preview.refreshDevices()}
              onStartLive={() => void preview.startLiveMonitoring()}
              inputLevel={preview.inputLevel}
              inputError={preview.inputError}
              permissionGranted={preview.permissionGranted}
            />

            {store.compareMode && store.comparePreset ? (
              <CompareView
                toneA={store.activePreset}
                toneB={store.comparePreset}
                presets={store.presets}
                onSelectB={store.setComparePresetId}
                onExit={() => store.setCompareMode(false)}
                audibleId={preview.audibleId}
                onAudibleChange={(w) => void preview.setAudible(w)}
              />
            ) : (
              <>
                <div className="tone-toolbar">
                  <div>
                    <h2 className="tone-title">{store.activePreset.name}</h2>
                    <p className="muted">
                      Updated{' '}
                      {new Date(store.activePreset.updatedAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>
                  <ExportBar preset={store.activePreset} />
                </div>

                <RigBoard
                  chain={store.activePreset.chain}
                  onAdd={store.addBlock}
                  onAddNam={store.addNamBlock}
                  onRemove={store.removeBlock}
                  onMove={store.moveBlock}
                  onParamChange={store.setBlockParam}
                  namStatus={namStatus}
                />

                <NotesPanel notes={store.activePreset.notes} onChange={store.setNotes} />
              </>
            )}
          </main>
        </div>
      )}

      <footer className="app-footer">
        <span>
          Tone Builder — factory gear suite · NAM (.nam) import · live input · synth preview · A/B
          · export
        </span>
      </footer>
    </div>
  );
}
