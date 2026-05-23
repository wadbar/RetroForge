import { persistentStorage } from "../services/indexedDBService";
import { storage } from "../services/storageService";
import { logger } from "../services/loggerService";
import { eventBus } from "../services/eventBus";
import { wsService } from "../services/websocketService";
import { auth, db } from "./firebase";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, serverTimestamp, query, where } from "firebase/firestore";

export interface ProjectMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  platform: string;
  fileSize: number;
  version: number;
  progress?: number;
  status?: string;
  lastSync?: string;
  efficiency?: string;
  tasks?: string[];
  health?: number;
  analysisStatus?: 'pending' | 'scanning' | 'ready' | 'error';
  ownerId?: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * ProjectService - Orchestrate lifecycle of binary modding projects with Cloud Sync.
 */
export class ProjectService {
  private projects: ProjectMetadata[] = [];
  private isCloudEnabled = false;

  constructor() {
    this.projects = storage.get<ProjectMetadata[]>('RF_PROJECTS') || [];

    // System Monitor: Listen for ROM changes triggered by backend fs.watch
    wsService.on("ROM_FILE_MUTATION", (data: any) => {
      logger.info(`[projectService] fs.watch: ROM file changed [${data.eventType}] - ${data.filename}`);
      eventBus.emit('ROM_SYNC_DETECTED', data);
    });

    auth.onAuthStateChanged(async (user) => {
      if (user) {
        this.isCloudEnabled = true;
        // Upsert user profile
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              email: user.email,
              displayName: user.displayName || user.email?.split('@')[0] || 'User',
              createdAt: serverTimestamp()
            });
          }
        } catch (e) {
          console.error("Cloud: Could not upsert user profile");
        }
        await this.syncFromCloud();
      } else {
        this.isCloudEnabled = false;
        // Revert to local only
        this.projects = storage.get<ProjectMetadata[]>('RF_PROJECTS') || [];
        eventBus.emit('PROJECTS_RELOADED', this.projects);
      }
    });
  }

  public async createProject(name: string, platform: string, data: Uint8Array): Promise<ProjectMetadata> {
    const id = crypto.randomUUID();
    const metadata: ProjectMetadata = {
      id,
      name,
      platform,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      fileSize: data.length,
      version: 1,
      status: 'pending',
      health: 100,
      analysisStatus: 'pending'
    };

    if (this.isCloudEnabled && auth.currentUser) {
      metadata.ownerId = auth.currentUser.uid;
      try {
         await setDoc(doc(db, 'projects', id), {
            name: metadata.name,
            platform: metadata.platform,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            status: metadata.status || 'pending',
            health: metadata.health || 100,
            analysisStatus: metadata.analysisStatus || 'pending',
            ownerId: metadata.ownerId,
         });
         metadata.lastSync = new Date().toISOString();
      } catch (error) {
         handleFirestoreError(error, OperationType.CREATE, `projects/${id}`);
      }
    }

    await persistentStorage.save(id, data);
    this.projects.push(metadata);
    this.syncLocal();
    
    eventBus.emit('PROJECT_CREATED', metadata);
    return metadata;
  }

  public async getProjects(): Promise<ProjectMetadata[]> {
    return this.projects;
  }

  public async loadFileData(id: string): Promise<Uint8Array | null> {
    return await persistentStorage.get(id); // Keep binary data local
  }

  public async updateProjectData(id: string, data?: Uint8Array, updates?: Partial<ProjectMetadata>): Promise<void> {
    const index = this.projects.findIndex(p => p.id === id);
    if (index === -1) throw new Error(`Project ${id} not found.`);

    if (updates?.health !== undefined && this.projects[index].health !== undefined) {
      if (Math.abs(this.projects[index].health - updates.health) >= 10) {
        const fileData = await this.loadFileData(id);
        if (fileData) {
          await import('./snapshotService').then(s => 
            s.snapshotService.createSnapshot(id, fileData, `Auto-backup pre-health change (${this.projects[index].health}% -> ${updates.health}%)`)
          );
        }
      }
    }

    if (data) {
       await persistentStorage.save(id, data);
       this.projects[index].fileSize = data.length;
    }

    if (updates) {
       Object.assign(this.projects[index], updates);
    }

    this.projects[index].updatedAt = Date.now();
    this.projects[index].version = (this.projects[index].version || 1) + 1;

    if (this.isCloudEnabled && auth.currentUser) {
      eventBus.emit('CLOUD_SYNC_START', null);
      try {
        const allowedUpdates: any = {};
        if (updates?.name !== undefined) allowedUpdates.name = updates.name;
        if (updates?.platform !== undefined) allowedUpdates.platform = updates.platform;
        if (updates?.status !== undefined) allowedUpdates.status = updates.status;
        if (updates?.health !== undefined) allowedUpdates.health = updates.health;
        if (updates?.analysisStatus !== undefined) allowedUpdates.analysisStatus = updates.analysisStatus;
        allowedUpdates.updatedAt = serverTimestamp();

        await updateDoc(doc(db, 'projects', id), allowedUpdates);
        this.projects[index].lastSync = new Date().toISOString();
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `projects/${id}`);
      } finally {
        eventBus.emit('CLOUD_SYNC_END', null);
      }
    }
    
    this.syncLocal();
    eventBus.emit('PROJECT_UPDATED', this.projects[index]);
    logger.info(`[PROJECT] Updated project ${id} to version ${this.projects[index].version}`);
  }

  public async deleteProject(id: string): Promise<void> {
    if (this.isCloudEnabled && auth.currentUser) {
       try {
         await deleteDoc(doc(db, 'projects', id));
       } catch (error) {
         handleFirestoreError(error, OperationType.DELETE, `projects/${id}`);
       }
    }
    await persistentStorage.delete(id);
    this.projects = this.projects.filter(p => p.id !== id);
    this.syncLocal();
    eventBus.emit('PROJECT_DELETED', { id });
  }

  private syncLocal() {
    storage.set('RF_PROJECTS', this.projects);
  }

  public async syncFromCloud(): Promise<void> {
    if (!this.isCloudEnabled || !auth.currentUser) return;
    try {
      const q = query(collection(db, 'projects'), where('ownerId', '==', auth.currentUser.uid));
      const querySnapshot = await getDocs(q);
      const cloudProjects: ProjectMetadata[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        cloudProjects.push({
          id: docSnap.id,
          name: data.name,
          platform: data.platform,
          status: data.status,
          health: data.health,
          analysisStatus: data.analysisStatus,
          ownerId: data.ownerId,
          createdAt: data.createdAt?.toMillis() || Date.now(),
          updatedAt: data.updatedAt?.toMillis() || Date.now(),
          fileSize: 0,
          version: 1,
          lastSync: new Date().toISOString()
        });
      });

      // Simple merge: remote wins for now
      this.projects = cloudProjects;
      this.syncLocal();
      eventBus.emit('PROJECTS_RELOADED', this.projects);
      logger.info("[PROJECT] Synced projects from Cloud.");
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'projects');
    }
  }
}

export const projectService = new ProjectService();
