/**
 * DI Container - Simple dependency injection for architectural decoupling.
 */
export class Container {
  private static instances = new Map<string, any>();

  /**
   * Registers a singleton instance.
   */
  public static register<T>(key: string, instance: T): void {
    this.instances.set(key, instance);
  }

  /**
   * Resolves a dependency.
   */
  public static resolve<T>(key: string): T {
    const instance = this.instances.get(key);
    if (!instance) {
      throw new Error(`Dependency not found: ${key}`);
    }
    return instance as T;
  }
}

// Service Keys
export const SERVICES = {
  LOGGER: 'logger',
  MONITOR: 'monitor',
  EVENT_BUS: 'eventBus',
  STORAGE: 'storage',
  AI_DECOMPILER: 'aiDecompiler',
  CONFIG: 'config'
};
