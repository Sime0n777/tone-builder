/**
 * IndexedDB library for imported Neural Amp Modeler (.nam) files.
 * Stores full model JSON for realtime WASM inference.
 */

import { parseNamFile, type ParsedNamModel } from './namParse';

const DB_NAME = 'tone-builder-nam';
const DB_VERSION = 1;
const STORE = 'models';

export interface NamLibraryEntry {
  id: string;
  fileName: string;
  displayName: string;
  architecture: string;
  version: string;
  sampleRate: number;
  weightCount: number;
  metadata: ParsedNamModel['metadata'];
  /** Full .nam JSON string for NamNode.loadModel */
  json: string;
  importedAt: string;
  /** Approximate byte size of json */
  sizeBytes: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('displayName', 'displayName', { unique: false });
        store.createIndex('importedAt', 'importedAt', { unique: false });
      }
    };
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

export async function listNamModels(): Promise<NamLibraryEntry[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const all = await reqToPromise(store.getAll() as IDBRequest<NamLibraryEntry[]>);
    return (all ?? []).sort((a, b) => b.importedAt.localeCompare(a.importedAt));
  } finally {
    db.close();
  }
}

export async function getNamModel(id: string): Promise<NamLibraryEntry | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const row = await reqToPromise(store.get(id) as IDBRequest<NamLibraryEntry | undefined>);
    return row ?? null;
  } finally {
    db.close();
  }
}

export async function deleteNamModel(id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    await reqToPromise(tx.objectStore(STORE).delete(id));
  } finally {
    db.close();
  }
}

export async function importNamFromFile(file: File): Promise<NamLibraryEntry> {
  const text = await file.text();
  const parsed = parseNamFile(file.name, text);
  return saveParsedNam(file.name, parsed);
}

export async function saveParsedNam(
  fileName: string,
  parsed: ParsedNamModel,
): Promise<NamLibraryEntry> {
  const entry: NamLibraryEntry = {
    id: crypto.randomUUID(),
    fileName,
    displayName: parsed.displayName,
    architecture: parsed.architecture,
    version: parsed.version,
    sampleRate: parsed.sampleRate,
    weightCount: parsed.weightCount,
    metadata: parsed.metadata,
    json: parsed.json,
    importedAt: new Date().toISOString(),
    sizeBytes: new Blob([parsed.json]).size,
  };

  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    await reqToPromise(tx.objectStore(STORE).put(entry));
  } finally {
    db.close();
  }
  return entry;
}
