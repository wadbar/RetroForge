import { storage } from "./storageService";
import { eventBus } from "./eventBus";
import { logger } from "./loggerService";

export interface SymbolDefinition {
  address: string;
  name: string;
  size: number;
  type: 'function' | 'data' | 'label';
  comment?: string;
}

/**
 * SymbolService - Industry-grade symbol mapping and management.
 * Persists known architecture entry points and user-identified routines.
 */
export class SymbolService {
  private symbols: Map<string, Map<string, SymbolDefinition>> = new Map(); // projectId -> address -> symbol

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    const data = storage.get<Record<string, SymbolDefinition[]>>('RF_SYMBOLS') || {};
    for (const [projectId, syms] of Object.entries(data)) {
      const projectMap = new Map<string, SymbolDefinition>();
      syms.forEach(s => projectMap.set(s.address, s));
      this.symbols.set(projectId, projectMap);
    }
  }

  private sync(projectId: string) {
    const data = storage.get<Record<string, SymbolDefinition[]>>('RF_SYMBOLS') || {};
    const syms = Array.from(this.symbols.get(projectId)?.values() || []);
    data[projectId] = syms;
    storage.set('RF_SYMBOLS', data);
  }

  public registerSymbol(projectId: string, symbol: SymbolDefinition): void {
    if (!this.symbols.has(projectId)) {
      this.symbols.set(projectId, new Map());
    }
    this.symbols.get(projectId)!.set(symbol.address, symbol);
    this.sync(projectId);
    eventBus.emit('SYMBOL_REGISTERED', { projectId, symbol });
    logger.info(`[SYMBOL] Registered ${symbol.type}: ${symbol.name} at ${symbol.address}`);
  }

  public getSymbols(projectId: string): SymbolDefinition[] {
    return Array.from(this.symbols.get(projectId)?.values() || []);
  }

  public getSymbolAt(projectId: string, address: string): SymbolDefinition | undefined {
    return this.symbols.get(projectId)?.get(address);
  }

  public renameSymbol(projectId: string, address: string, newName: string): void {
    const sym = this.getSymbolAt(projectId, address);
    if (sym) {
      sym.name = newName;
      this.sync(projectId);
      eventBus.emit('SYMBOL_UPDATED', { projectId, symbol: sym });
    }
  }
}

export const symbolService = new SymbolService();
