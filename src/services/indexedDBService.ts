import { logger } from "./loggerService";

/**
 * IndexedDBService - Industrial-grade persistence for large binary files (ROMs, Patches).
 * Bypasses the 5MB limit of LocalStorage.
 */
export class IndexedDBService {
  private dbName = "RetroForge_DB";
  private storeName = "blobs";
  private db: IDBDatabase | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        logger.info("IndexedDB initialized successfully.");
        resolve();
      };

      request.onerror = () => {
        logger.error("Failed to initialize IndexedDB", request.error);
        reject(request.error);
      };
    });
  }

  public async save(key: string, data: Uint8Array): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.put(data, key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async get(key: string): Promise<Uint8Array | null> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  public async delete(key: string): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const persistentStorage = new IndexedDBService();
