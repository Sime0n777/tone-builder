import { useCallback, useEffect, useRef, useState } from 'react';
import { ToneEngine, type PreviewNote } from '../audio/ToneEngine';
import type { TonePreset } from '../types/tone';

export function useTonePreview() {
  const engineRef = useRef<ToneEngine | null>(null);
  const [playing, setPlaying] = useState(false);
  const [note, setNoteState] = useState<PreviewNote>('A2');
  const [audibleId, setAudibleId] = useState<'A' | 'B'>('A');
  const debounceRef = useRef<number | null>(null);
  const presetRef = useRef<TonePreset | null>(null);
  const compareRef = useRef<TonePreset | null>(null);
  const compareModeRef = useRef(false);

  useEffect(() => {
    engineRef.current = new ToneEngine();
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  const activePreset = useCallback(() => {
    if (compareModeRef.current && audibleId === 'B' && compareRef.current) {
      return compareRef.current;
    }
    return presetRef.current;
  }, [audibleId]);

  const play = useCallback(async () => {
    const engine = engineRef.current;
    const preset = activePreset();
    if (!engine || !preset) return;
    await engine.start(preset, note);
    setPlaying(true);
  }, [activePreset, note]);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    setPlaying(false);
  }, []);

  const toggle = useCallback(async () => {
    if (playing) stop();
    else await play();
  }, [playing, play, stop]);

  const setNote = useCallback(
    (n: PreviewNote) => {
      setNoteState(n);
      engineRef.current?.setNote(n);
    },
    [],
  );

  /** Sync presets into the hook; rebuild/update audio when playing. */
  const syncPresets = useCallback(
    (active: TonePreset | null, compare: TonePreset | null, compareMode: boolean) => {
      presetRef.current = active;
      compareRef.current = compare;
      compareModeRef.current = compareMode;

      if (!playing || !engineRef.current) return;

      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        const preset =
          compareMode && audibleId === 'B' && compare ? compare : active;
        if (preset) engineRef.current?.updateParams(preset);
      }, 60);
    },
    [playing, audibleId],
  );

  const setAudible = useCallback(
    async (which: 'A' | 'B') => {
      setAudibleId(which);
      if (!playing || !engineRef.current) return;
      const preset =
        which === 'B' && compareRef.current ? compareRef.current : presetRef.current;
      if (preset) await engineRef.current.start(preset, note);
    },
    [playing, note],
  );

  return {
    playing,
    note,
    audibleId,
    play,
    stop,
    toggle,
    setNote,
    setAudible,
    syncPresets,
  };
}
