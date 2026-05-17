import { storage } from "./storageService";
import { eventBus } from "./eventBus";

export interface AppConfig {
  turboMode: boolean;
  lmStudioUrl: string;
  targetArch: string;
  autoSave: boolean;
  debugMode: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  turboMode: false,
  lmStudioUrl: "http://localhost:11434/api/generate",
  targetArch: "MIPS R3000",
  autoSave: true,
  debugMode: process.env.NODE_ENV !== 'production'
};

/**
 * ConfigService - Centralized, persistent configuration management.
 */
export class ConfigService {
  private config: AppConfig;

  constructor() {
    const saved = storage.get<AppConfig>('RF_CONFIG');
    this.config = saved ? { ...DEFAULT_CONFIG, ...saved } : DEFAULT_CONFIG;
  }

  public get(): AppConfig {
    return { ...this.config };
  }

  public update(newConfig: Partial<AppConfig>) {
    this.config = { ...this.config, ...newConfig };
    storage.set('RF_CONFIG', this.config);
    eventBus.emit('CONFIG_UPDATED', this.config);
  }
}

export const configService = new ConfigService();
