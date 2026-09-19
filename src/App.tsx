import { useEffect } from 'react';
import { CompareView } from './components/CompareView';
import { EmptyState } from './components/EmptyState';
import { ExportBar } from './components/ExportBar';
import { Header } from './components/Header';
import { NotesPanel } from './components/NotesPanel';
import { PreviewControls } from './components/PreviewControls';
import { SignalChain } from './components/SignalChain';
import { ToneLibrary } from './components/ToneLibrary';
import { useTonePreview } from './hooks/useTonePreview';
import { useToneStore } from './hooks/useToneStore';

export default function App() {
  const store = useToneStore();
  const preview = useTonePreview();

  useEffect(() => {
    preview.syncPresets(store.activePreset, store.comparePreset, store.compareMode);
  }, [
    store.activePreset,
    store.comparePreset,
    store.compareMode,
    preview.syncPresets,
  ]);

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

                <SignalChain
                  chain={store.activePreset.chain}
                  onAdd={store.addBlock}
                  onRemove={store.removeBlock}
                  onMove={store.moveBlock}
                  onParamChange={store.setBlockParam}
                />

                <NotesPanel notes={store.activePreset.notes} onChange={store.setNotes} />
              </>
            )}
          </main>
        </div>
      )}

      <footer className="app-footer">
        <span>
          Tone Builder — local presets · synth preview · live guitar input · approximate Web
          Audio
        </span>
      </footer>
    </div>
  );
}
