/**
 * Core Domain Entities and Types
 * These are invariant and independent of frameworks.
 */

export type ArchType = 'MIPS_R3000' | 'M68000' | 'SH2' | 'PPC' | 'ARM_THUMB' | 'Z80' | 'MOS6502' | 'x86' | 'x86_64';

export interface DecompContext {
  arch: ArchType;
  intent: string;
}

export interface TranslatedString {
  id: string;
  original: string;
  translation: string;
  status: 'reviewed' | 'pending' | 'auto-translated';
  key: string;
}

export interface BinarySearchResult {
  offset: string;
  snippet: string;
}

export enum SystemStatus {
  OPTIMAL = 'optimal',
  DEGRADED = 'degraded',
  CRITICAL = 'critical',
}

export interface SystemHealth {
  status: SystemStatus;
  lastError?: string;
  operationsCount: number;
  uptime: number;
  metrics: {
    latency: number[];
    errorRate: number;
    memoryUsage: number;
  };
}
