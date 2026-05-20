import { monitor } from "./monitorService";
import { logger } from "./loggerService";
import { eventBus } from "./eventBus";

import { SystemStatus } from "../core/types";

/**
 * SelfHealingService - Autonomous recovery for the RetroForge ecosystem.
 * Monitors health metrics and executes restorative actions.
 */
export class SelfHealingService {
  private static isHealing = false;

  static {
    eventBus.on('SELF_HEALING_REQUIRED', () => {
      this.executeEmergencyProtocol();
    });
    
    // Periodic check as fallback
    setInterval(() => this.checkAndHeal(), 30000);
  }

  public static async checkAndHeal(): Promise<void> {
    if (this.isHealing) return;

    const health = monitor.getHealthData();
    
    // Condition 1: Error rate too high (> 20%)
    const errorRate = health.metrics.errorRate;
    
    if (errorRate > 0.2 || health.status === SystemStatus.CRITICAL) {
      await this.executeEmergencyProtocol();
    }
  }

  private static async executeEmergencyProtocol(): Promise<void> {
    this.isHealing = true;
    logger.fatal("[SELF-HEALING] Emergency protocol initiated. System degradation detected.");
    eventBus.emit('SELF_HEALING_REQUIRED', { reason: 'High Error Rate' });

    // Step 1: Nuclear Cache Purge
    localStorage.removeItem('AI_CACHE'); 
    localStorage.removeItem('PROJECTS');
    localStorage.removeItem('SETTINGS');
    
    // Step 2: Metrics Reset
    monitor.resetMetrics();
    logger.info("[SELF-HEALING] System metrics reset. Caches cleared. Monitoring continued.");
    
    this.isHealing = false;
  }
}
