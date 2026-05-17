import { persistentStorage } from "./indexedDBService";
import { logger } from "./loggerService";
import { eventBus } from "./eventBus";
import { monitor } from "./monitorService";

export interface Snapshot {
  id: string;
  projectId: string;
  timestamp: number;
  label: string;
}

/**
 * SnapshotService - Implementation of binary version control.
 * Allows rollbacks and branching for experimental mods.
 */
export class SnapshotService {
  public async createSnapshot(projectId: string, data: Uint8Array, label: string): Promise<Snapshot> {
    const snapshotId = `snapshot_${crypto.randomUUID()}`;
    const timestamp = Date.now();
    
    await persistentStorage.save(snapshotId, data);
    
    // Maintain a registry of snapshots for visibility
    const registry = JSON.parse(localStorage.getItem('RF_SNAPSHOTS') || '[]');
    const snapshot: Snapshot = {
      id: snapshotId,
      projectId,
      timestamp,
      label
    };
    registry.push(snapshot);
    localStorage.setItem('RF_SNAPSHOTS', JSON.stringify(registry));

    logger.info(`[SNAPSHOT] Created: ${label} for project ${projectId}`);
    eventBus.emit('SNAPSHOT_CREATED', snapshot);
    monitor.trackOperation('BINARY_SNAPSHOT');
    
    return snapshot;
  }

  public async restoreSnapshot(snapshotId: string): Promise<Uint8Array | null> {
    logger.info(`[SNAPSHOT] Restoring: ${snapshotId}`);
    return await persistentStorage.get(snapshotId);
  }
}

export const snapshotService = new SnapshotService();
