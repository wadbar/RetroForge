import { ArchType } from './types';

export interface GlobalSettings {
  sdkPath: string;
  lmStudioUrl: string;
  customAiPrompt: string;
  turboMode: boolean;
  autoSave: boolean;
  theme?: 'dark' | 'light' | 'system';
  language?: string;
}

export type TranslationStatus = 'reviewed' | 'pending' | 'auto-translated';

export interface ExtractedString {
  id: string;
  original: string;
  translation: string;
  status: TranslationStatus;
  key: string;
}

export interface MemorySegment {
  start: number;
  end: number;
  type: 'CODE' | 'DATA' | 'STRINGS' | 'RESOURCES';
}

export interface PatchAction {
  id: string;
  name: string;
  offset: string;
  bytes: string;
  active: boolean;
}

export interface UnifiedProjectMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  platform: ArchType | string;
  fileSize: number;
  version: number;
  
  // Dashboard & Lifecycle Metrics
  progress: number;
  status: string;
  lastSync: string;
  efficiency: string;
  tasks: string[];
  health: number; // 0-100
  analysisStatus: 'pending' | 'scanning' | 'ready' | 'error';
  
  // Assistant Memory Core
  agentMemory: Record<string, any>;
  
  // Translation Studio Data
  extractedStrings: ExtractedString[];
  
  // Modding Hub Data
  patches: PatchAction[];
  memorySegments: MemorySegment[];
}

export interface AppState {
  settings: GlobalSettings;
  projects: Record<string, UnifiedProjectMetadata>;
  activeProjectId: string | null;
}
