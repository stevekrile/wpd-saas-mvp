const DB_NAME = 'wpd-rogue-brick';
const DB_VERSION = 1;
const STORE_NAME = 'saveDocuments';
const ANONYMOUS_SAVE_KEY = 'anonymous-profile';

export interface RogueBrickStoredProgress {
  progressJson: string;
  updatedAtEpochMs: number;
}

export interface RogueBrickPersistenceStore {
  load(): Promise<RogueBrickStoredProgress | null>;
  save(progressJson: string): Promise<RogueBrickStoredProgress>;
  clear(): Promise<void>;
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this environment.'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open Rogue Brick local database.'));
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = action(store);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Rogue Brick local database request failed.'));
        transaction.oncomplete = () => database.close();
        transaction.onabort = () => {
          reject(transaction.error ?? new Error('Rogue Brick local database transaction aborted.'));
          database.close();
        };
        transaction.onerror = () => {
          reject(transaction.error ?? new Error('Rogue Brick local database transaction failed.'));
          database.close();
        };
      })
  );
}

export const browserRogueBrickPersistence: RogueBrickPersistenceStore = {
  async load() {
    const stored = await withStore<unknown>('readonly', (store) => store.get(ANONYMOUS_SAVE_KEY));
    if (!stored || typeof stored !== 'object') {
      return null;
    }

    const record = stored as Partial<RogueBrickStoredProgress>;
    if (typeof record.progressJson !== 'string') {
      return null;
    }

    return {
      progressJson: record.progressJson,
      updatedAtEpochMs:
        typeof record.updatedAtEpochMs === 'number' && Number.isFinite(record.updatedAtEpochMs)
          ? record.updatedAtEpochMs
          : 0,
    };
  },

  async save(progressJson) {
    const record: RogueBrickStoredProgress = {
      progressJson,
      updatedAtEpochMs: Date.now(),
    };

    await withStore<IDBValidKey>('readwrite', (store) => store.put(record, ANONYMOUS_SAVE_KEY));
    return record;
  },

  async clear() {
    await withStore<undefined>('readwrite', (store) => store.delete(ANONYMOUS_SAVE_KEY));
  },
};
