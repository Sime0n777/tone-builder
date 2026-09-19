import { useCallback, useEffect, useMemo, useState } from 'react';
import { SEED_TONES } from '../data/seedTones';
import { createBlockParams } from '../data/blockCatalog';
import type { NamLibraryEntry } from '../audio/namLibrary';
import type { AppState, ChainBlock, TonePreset } from '../types/tone';
import { categoryToZone, type RigZone } from '../types/tone';
import { getBlockType } from '../data/blockCatalog';

const STORAGE_KEY = 'tone-builder:v1';

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.presets?.length) return parsed;
    }
  } catch {
    /* ignore corrupt storage */
  }
  return {
    presets: SEED_TONES,
    activePresetId: SEED_TONES[0]?.id ?? null,
    comparePresetId: SEED_TONES[1]?.id ?? null,
    compareMode: false,
  };
}

function persist(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function nowIso() {
  return new Date().toISOString();
}

export function useToneStore() {
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => {
    persist(state);
  }, [state]);

  const activePreset = useMemo(
    () => state.presets.find((p) => p.id === state.activePresetId) ?? null,
    [state.presets, state.activePresetId],
  );

  const comparePreset = useMemo(
    () => state.presets.find((p) => p.id === state.comparePresetId) ?? null,
    [state.presets, state.comparePresetId],
  );

  const updateActive = useCallback((updater: (p: TonePreset) => TonePreset) => {
    setState((s) => {
      if (!s.activePresetId) return s;
      return {
        ...s,
        presets: s.presets.map((p) =>
          p.id === s.activePresetId ? updater({ ...p, updatedAt: nowIso() }) : p,
        ),
      };
    });
  }, []);

  const selectPreset = useCallback((id: string) => {
    setState((s) => ({ ...s, activePresetId: id }));
  }, []);

  const createPreset = useCallback((name = 'New Tone') => {
    const preset: TonePreset = {
      id: crypto.randomUUID(),
      name,
      notes: '',
      chain: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    setState((s) => ({
      ...s,
      presets: [...s.presets, preset],
      activePresetId: preset.id,
      compareMode: false,
    }));
    return preset.id;
  }, []);

  const renamePreset = useCallback((id: string, name: string) => {
    setState((s) => ({
      ...s,
      presets: s.presets.map((p) =>
        p.id === id ? { ...p, name, updatedAt: nowIso() } : p,
      ),
    }));
  }, []);

  const duplicatePreset = useCallback((id: string) => {
    setState((s) => {
      const source = s.presets.find((p) => p.id === id);
      if (!source) return s;
      const copy: TonePreset = {
        ...structuredClone(source),
        id: crypto.randomUUID(),
        name: `${source.name} (copy)`,
        chain: source.chain.map((b) => ({ ...b, id: crypto.randomUUID() })),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      return {
        ...s,
        presets: [...s.presets, copy],
        activePresetId: copy.id,
      };
    });
  }, []);

  const deletePreset = useCallback((id: string) => {
    setState((s) => {
      const next = s.presets.filter((p) => p.id !== id);
      let activePresetId = s.activePresetId;
      let comparePresetId = s.comparePresetId;
      if (activePresetId === id) activePresetId = next[0]?.id ?? null;
      if (comparePresetId === id) comparePresetId = next.find((p) => p.id !== activePresetId)?.id ?? null;
      return {
        ...s,
        presets: next,
        activePresetId,
        comparePresetId,
        compareMode: s.compareMode && next.length >= 2,
      };
    });
  }, []);

  const setNotes = useCallback(
    (notes: string) => {
      updateActive((p) => ({ ...p, notes }));
    },
    [updateActive],
  );

  const insertByZone = (chain: ChainBlock[], block: ChainBlock): ChainBlock[] => {
    const def = getBlockType(block.typeId);
    const zone: RigZone = def ? categoryToZone(def.category) : 'rack';
    const zoneRank: Record<RigZone, number> = {
      pedalboard: 0,
      amp: 1,
      cab: 2,
      rack: 3,
    };
    const rank = zoneRank[zone];
    let insertAt = chain.length;
    for (let i = 0; i < chain.length; i++) {
      const d = getBlockType(chain[i]!.typeId);
      const z = d ? categoryToZone(d.category) : 'rack';
      if (zoneRank[z] > rank) {
        insertAt = i;
        break;
      }
    }
    const next = [...chain];
    next.splice(insertAt, 0, block);
    return next;
  };

  const addBlock = useCallback(
    (typeId: string) => {
      updateActive((p) => {
        const block: ChainBlock = {
          id: crypto.randomUUID(),
          typeId,
          params: createBlockParams(typeId),
        };
        return { ...p, chain: insertByZone(p.chain, block) };
      });
    },
    [updateActive],
  );

  const addNamBlock = useCallback(
    (entry: NamLibraryEntry) => {
      updateActive((p) => {
        const existingIdx = p.chain.findIndex((b) => b.typeId === 'nam-amp');
        const params = {
          ...createBlockParams('nam-amp'),
          modelId: entry.id,
          modelName: entry.displayName,
          architecture: entry.architecture,
        };
        if (existingIdx >= 0) {
          return {
            ...p,
            chain: p.chain.map((b, i) =>
              i === existingIdx ? { ...b, params: { ...b.params, ...params } } : b,
            ),
          };
        }
        // Prefer replacing a factory amp if present
        const ampIdx = p.chain.findIndex((b) => getBlockType(b.typeId)?.category === 'amp');
        const block: ChainBlock = {
          id: crypto.randomUUID(),
          typeId: 'nam-amp',
          params,
        };
        if (ampIdx >= 0) {
          const chain = [...p.chain];
          chain[ampIdx] = block;
          return { ...p, chain };
        }
        return { ...p, chain: insertByZone(p.chain, block) };
      });
    },
    [updateActive],
  );

  const removeBlock = useCallback(
    (blockId: string) => {
      updateActive((p) => ({
        ...p,
        chain: p.chain.filter((b) => b.id !== blockId),
      }));
    },
    [updateActive],
  );

  const moveBlock = useCallback(
    (blockId: string, direction: -1 | 1) => {
      updateActive((p) => {
        const idx = p.chain.findIndex((b) => b.id === blockId);
        if (idx < 0) return p;
        const target = idx + direction;
        if (target < 0 || target >= p.chain.length) return p;
        const chain = [...p.chain];
        const [item] = chain.splice(idx, 1);
        chain.splice(target, 0, item);
        return { ...p, chain };
      });
    },
    [updateActive],
  );

  const setBlockParam = useCallback(
    (blockId: string, paramId: string, value: number | string | boolean) => {
      updateActive((p) => ({
        ...p,
        chain: p.chain.map((b) =>
          b.id === blockId ? { ...b, params: { ...b.params, [paramId]: value } } : b,
        ),
      }));
    },
    [updateActive],
  );

  const setCompareMode = useCallback((on: boolean) => {
    setState((s) => ({ ...s, compareMode: on }));
  }, []);

  const setComparePresetId = useCallback((id: string) => {
    setState((s) => ({ ...s, comparePresetId: id }));
  }, []);

  const resetToSeeds = useCallback(() => {
    const fresh = SEED_TONES.map((t) => ({
      ...t,
      id: crypto.randomUUID(),
      chain: t.chain.map((b) => ({ ...b, id: crypto.randomUUID() })),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }));
    setState({
      presets: fresh,
      activePresetId: fresh[0]?.id ?? null,
      comparePresetId: fresh[1]?.id ?? null,
      compareMode: false,
    });
  }, []);

  return {
    presets: state.presets,
    activePreset,
    comparePreset,
    compareMode: state.compareMode,
    selectPreset,
    createPreset,
    renamePreset,
    duplicatePreset,
    deletePreset,
    setNotes,
    addBlock,
    addNamBlock,
    removeBlock,
    moveBlock,
    setBlockParam,
    setCompareMode,
    setComparePresetId,
    resetToSeeds,
  };
}
