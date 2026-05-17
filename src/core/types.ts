/**
 * Core Domain Entities and Types
 * These are invariant and independent of frameworks.
 */

export type ArchType = 'MIPS_R3000' | 'M68000' | 'SH2' | 'PPC' | 'ARM_THUMB' | 'Z80' | 'MOS6502' | 'x86' | 'x86_64';

export const ARCH_METADATA: Record<ArchType, { 
  name: string, 
  endian: 'big' | 'little' | 'selectable', 
  bits: 8 | 16 | 32 | 64,
  typicalOpcodes: string[],
  delaySlots: boolean
}> = {
  'MIPS_R3000': { name: 'MIPS R3000 (PS1)', endian: 'little', bits: 32, typicalOpcodes: ['addiu', 'sw', 'lw', 'jal'], delaySlots: true },
  'M68000': { name: 'Motorola 68000 (MegaDrive)', endian: 'big', bits: 16, typicalOpcodes: ['move', 'lea', 'bsr', 'trap'], delaySlots: false },
  'SH2': { name: 'SuperH-2 (Saturn)', endian: 'big', bits: 32, typicalOpcodes: ['mov.l', 'sts', 'bra', 'jsr'], delaySlots: true },
  'PPC': { name: 'PowerPC (GC/Wii)', endian: 'big', bits: 32, typicalOpcodes: ['lis', 'ori', 'lwz', 'stw'], delaySlots: false },
  'ARM_THUMB': { name: 'ARM Thumb (GBA)', endian: 'little', bits: 32, typicalOpcodes: ['push', 'mov', 'bl', 'add'], delaySlots: false },
  'Z80': { name: 'Zilog Z80 (SMS/GB)', endian: 'little', bits: 8, typicalOpcodes: ['ld', 'call', 'inc', 'bit'], delaySlots: false },
  'MOS6502': { name: 'MOS 6502 (NES)', endian: 'little', bits: 8, typicalOpcodes: ['lda', 'sta', 'jsr', 'jmp'], delaySlots: false },
  'x86': { name: 'Intel x86 (32-bit)', endian: 'little', bits: 32, typicalOpcodes: ['mov', 'push', 'call', 'jmp'], delaySlots: false },
  'x86_64': { name: 'Intel x86-64', endian: 'little', bits: 64, typicalOpcodes: ['movq', 'pushq', 'callq', 'jmpq'], delaySlots: false },
};

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
