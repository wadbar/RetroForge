import { logger } from "./loggerService";
import { monitor } from "./monitorService";

/**
 * StorageService - Abstract persistence layer.
 * Currently uses LocalStorage, ready for Firebase/Cloud sync.
 */
class StorageService {
  private static readonly PREFIX = 'retroforge_';

  /**
   * Saves data to local storage with automated error tracking and logging.
   */
  public set(key: string, value: any): void {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(StorageService.PREFIX + key, serialized);
      logger.debug(`Stored ${key} (${serialized.length} bytes)`);
    } catch (error) {
      logger.error(`Storage failure for key ${key}: ${error}`);
      monitor.reportError(error as Error);
    }
  }

  /**
   * Retrieves data from local storage.
   */
  public get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(StorageService.PREFIX + key);
      if (!item) return null;
      return JSON.parse(item) as T;
    } catch (error) {
      logger.error(`Storage retrieval failure for key ${key}: ${error}`);
      return null;
    }
  }

  /**
   * Removes an item.
   */
  public remove(key: string): void {
    localStorage.removeItem(StorageService.PREFIX + key);
    logger.info(`Removed ${key} from storage`);
  }

  /**
   * Clears all system data.
   */
  public clear(): void {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(StorageService.PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
    logger.warn('Storage cleared successfully.');
  }
}

export const storage = new StorageService();
