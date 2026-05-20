import { persistentStorage } from "../services/indexedDBService";
import { storage } from "../services/storageService";
import { logger } from "../services/loggerService";
import { eventBus } from "../services/eventBus";

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
}

/**
 * ProjectService - Orchestrate lifecycle of binary modding projects.
 */
export class ProjectService {
  private projects: ProjectMetadata[] = [];

  constructor() {
    this.projects = storage.get<ProjectMetadata[]>('RF_PROJECTS') || [];
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
      version: 1
    };

    await persistentStorage.save(id, data);
    this.projects.push(metadata);
    this.sync();
    
    eventBus.emit('PROJECT_CREATED', metadata);
    return metadata;
  }

  public async getProjects(): Promise<ProjectMetadata[]> {
    return this.projects;
  }

  public async loadFileData(id: string): Promise<Uint8Array | null> {
    return await persistentStorage.get(id);
  }

  public async updateProjectData(id: string, data: Uint8Array): Promise<void> {
    const index = this.projects.findIndex(p => p.id === id);
    if (index === -1) throw new Error(`Project ${id} not found.`);

    await persistentStorage.save(id, data);
    this.projects[index] = {
      ...this.projects[index],
      updatedAt: Date.now(),
      version: (this.projects[index].version || 1) + 1,
      fileSize: data.length
    };
    
    this.sync();
    eventBus.emit('PROJECT_UPDATED', this.projects[index]);
    logger.info(`[PROJECT] Updated project ${id} to version ${this.projects[index].version}`);
  }

  public async deleteProject(id: string): Promise<void> {
    await persistentStorage.delete(id);
    this.projects = this.projects.filter(p => p.id !== id);
    this.sync();
    eventBus.emit('PROJECT_DELETED', { id });
  }

  private sync() {
    storage.set('RF_PROJECTS', this.projects);
  }
}

export const projectService = new ProjectService();
