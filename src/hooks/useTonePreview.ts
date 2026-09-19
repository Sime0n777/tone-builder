import { useCallback, useEffect, useRef, useState } from 'react';
import { ToneEngine, type PreviewNote, type SourceMode } from '../audio/ToneEngine';
import type { TonePreset } from '../types/tone';

function mapMediaError(err: unknown): string {
  if (!window.isSecureContext) {
    return 'Microphone access requires a secure context (localhost or HTTPS).';
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'This browser does not support audio input (getUserMedia).';
  }
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return 'Microphone permission denied. Allow access in the browser site settings.';
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return 'No audio input device found. Plug in your interface and refresh the device list.';
    }
    if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      return 'Could not open the selected input (device may be in use by another app).';
    }
    if (err.name === 'OverconstrainedError') {
      return 'Selected device is unavailable. Pick another input or refresh the list.';
    }
    return err.message || err.name;
  }
  if (err instanceof Error) return err.message;
  return 'Failed to enable audio input.';
}

export function useTonePreview() {
  const engineRef = useRef<ToneEngine | null>(null);
  const [playing, setPlaying] = useState(false);
  const [note, setNoteState] = useState<PreviewNote>('A2');
  const [audibleId, setAudibleId] = useState<'A' | 'B'>('A');
  const [sourceMode, setSourceModeState] = useState<SourceMode>('synth');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [inputLevel, setInputLevel] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const presetRef = useRef<TonePreset | null>(null);
  const compareRef = useRef<TonePreset | null>(null);
  const compareModeRef = useRef(false);
  const sourceModeRef = useRef<SourceMode>('synth');
  const selectedDeviceIdRef = useRef('');

  const stopMeter = useCallback(() => {
    if (meterRafRef.current != null) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    setInputLevel(0);
  }, []);

  const startMeter = useCallback(() => {
    stopMeter();
    const tick = () => {
      const level = engineRef.current?.getInputLevel() ?? 0;
      setInputLevel(level);
      meterRafRef.current = requestAnimationFrame(tick);
    };
    meterRafRef.current = requestAnimationFrame(tick);
  }, [stopMeter]);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setDevices([]);
      return;
    }
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const inputs = all.filter((d) => d.kind === 'audioinput');
      setDevices(inputs);
      setSelectedDeviceId((prev) => {
        if (prev && inputs.some((d) => d.deviceId === prev)) return prev;
        const first = inputs[0]?.deviceId ?? '';
        selectedDeviceIdRef.current = first;
        return first;
      });
    } catch {
      /* ignore enumerate failures */
    }
  }, []);

  useEffect(() => {
    engineRef.current = new ToneEngine();
    void refreshDevices();

    const onDeviceChange = () => {
      void refreshDevices();
    };
    navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      stopMeter();
      navigator.mediaDevices?.removeEventListener?.('devicechange', onDeviceChange);
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, [refreshDevices, stopMeter]);

  const activePreset = useCallback(() => {
    if (compareModeRef.current && audibleId === 'B' && compareRef.current) {
      return compareRef.current;
    }
    return presetRef.current;
  }, [audibleId]);

  const stop = useCallback(() => {
    stopMeter();
    engineRef.current?.stop();
    setPlaying(false);
  }, [stopMeter]);

  const play = useCallback(async () => {
    const engine = engineRef.current;
    const preset = activePreset();
    if (!engine || !preset) return;
    setInputError(null);
    await engine.start(preset, note);
    setPlaying(true);
  }, [activePreset, note]);

  const startLiveMonitoring = useCallback(
    async (presetOverride?: TonePreset | null) => {
      const engine = engineRef.current;
      const preset = presetOverride ?? activePreset();
      if (!engine || !preset) return;

      if (!window.isSecureContext) {
        setInputError('Microphone access requires a secure context (localhost or HTTPS).');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setInputError('This browser does not support audio input (getUserMedia).');
        return;
      }

      setInputError(null);
      stopMeter();
      engine.stop();
      setPlaying(false);

      const deviceId = selectedDeviceIdRef.current || selectedDeviceId;
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      };

      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
        } catch (firstErr) {
          if (deviceId) {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                deviceId: { ideal: deviceId },
              },
            });
          } else {
            throw firstErr;
          }
        }

        setPermissionGranted(true);
        await refreshDevices();

        const trackDevice = stream.getAudioTracks()[0]?.getSettings().deviceId;
        if (trackDevice) {
          selectedDeviceIdRef.current = trackDevice;
          setSelectedDeviceId(trackDevice);
        }

        await engine.startLive(preset, stream);
        setPlaying(true);
        startMeter();
      } catch (err) {
        setInputError(mapMediaError(err));
        setPlaying(false);
      }
    },
    [activePreset, refreshDevices, selectedDeviceId, startMeter, stopMeter],
  );

  const toggle = useCallback(async () => {
    if (playing) {
      stop();
      return;
    }
    if (sourceModeRef.current === 'live') {
      await startLiveMonitoring();
    } else {
      await play();
    }
  }, [playing, stop, play, startLiveMonitoring]);

  const setNote = useCallback((n: PreviewNote) => {
    setNoteState(n);
    engineRef.current?.setNote(n);
  }, []);

  const setSourceMode = useCallback(
    (mode: SourceMode) => {
      if (mode === sourceModeRef.current) return;
      stop();
      sourceModeRef.current = mode;
      setSourceModeState(mode);
      setInputError(null);
    },
    [stop],
  );

  const setDeviceId = useCallback(
    (id: string) => {
      selectedDeviceIdRef.current = id;
      setSelectedDeviceId(id);
      if (playing && sourceModeRef.current === 'live') {
        void startLiveMonitoring();
      }
    },
    [playing, startLiveMonitoring],
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
      if (!preset) return;

      if (sourceModeRef.current === 'live') {
        await startLiveMonitoring(preset);
      } else {
        await engineRef.current.start(preset, note);
      }
    },
    [playing, note, startLiveMonitoring],
  );

  return {
    playing,
    note,
    audibleId,
    sourceMode,
    devices,
    selectedDeviceId,
    inputError,
    inputLevel,
    permissionGranted,
    play,
    stop,
    toggle,
    setNote,
    setAudible,
    syncPresets,
    setSourceMode,
    setDeviceId,
    refreshDevices,
    startLiveMonitoring,
  };
}
