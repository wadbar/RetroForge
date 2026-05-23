import { SystemHealth, SystemStatus } from "../core/types";
import { logger } from "./loggerService";
import { eventBus } from "./eventBus";

/**
 * MonitorService - Autonomous health and performance tracking.
 * Implements the "Infinite Evolution" loop by reporting its own state.
 */
class MonitorService {
  private health: SystemHealth = {
    status: SystemStatus.OPTIMAL,
    operationsCount: 0,
    uptime: Date.now(),
    metrics: {
      latency: [],
      errorRate: 0,
      memoryUsage: 0
    }
  };
  private serviceStatus = new Map<string, SystemStatus>();
  private healingHistory: { origin: string; timestamp: number }[] = [];

  /**
   * Records a metric and triggers self-healing if needed.
   */
  public recordMetric(metricName: string, durationMs: number, isError = false) {
    this.health.operationsCount++;
    this.health.metrics.latency.push(durationMs);
    if (this.health.metrics.latency.length > 100) this.health.metrics.latency.shift();
    
    // Exponential Moving Average for error rate
    const alpha = 0.1;
    this.health.metrics.errorRate = (this.health.metrics.errorRate * (1 - alpha)) + (isError ? alpha : 0);

    if (durationMs > 2000) {
      logger.warn(`SLA Breach in ${metricName}: ${durationMs}ms`);
      this.serviceStatus.set(metricName, SystemStatus.DEGRADED);
    } else {
      this.serviceStatus.set(metricName, SystemStatus.OPTIMAL);
    }

    if (this.health.metrics.errorRate > 0.4) {
      this.health.status = SystemStatus.CRITICAL;
      this.triggerSelfHealing(metricName);
    } else if (this.health.metrics.errorRate > 0.1) {
      this.health.status = SystemStatus.DEGRADED;
    } else {
      this.health.status = SystemStatus.OPTIMAL;
    }
  }

  private triggerSelfHealing(origin: string) {
    logger.fatal(`Self-healing triggered for origin: ${origin}. Current Error Rate: ${(this.health.metrics.errorRate * 100).toFixed(1)}%`);
    this.healingHistory.push({ origin, timestamp: Date.now() });
    if (this.healingHistory.length > 10) this.healingHistory.shift();
    eventBus.emit('SELF_HEALING_REQUIRED', { origin, timestamp: Date.now() });
  }

  public getServiceStatus(name: string): SystemStatus {
    return this.serviceStatus.get(name) || SystemStatus.OPTIMAL;
  }

  public getHealingHistory() {
    return [...this.healingHistory];
  }

  public resetMetrics() {
    this.health.metrics = {
      latency: [],
      errorRate: 0,
      memoryUsage: 0
    };
    this.health.status = SystemStatus.OPTIMAL;
    this.health.lastError = null;
    this.serviceStatus.clear();
    logger.info("[MONITOR] Metrics reset by system instruction.");
  }

  constructor() {
    this.startSelfAudit();
  }

  public trackOperation(serviceName: string) {
    this.health.operationsCount++;
    logger.debug(`Pulse from ${serviceName}. Ops: ${this.health.operationsCount}`);
  }

  public trackIntegrity(projectId: string, crc: number) {
    logger.info(`[INTEGRITY] Project ${projectId} checksum: ${crc.toString(16).toUpperCase()}`);
    eventBus.emit('INTEGRITY_CHECK', { projectId, crc });
  }

  private resourceThresholdStartedAt: number | null = null;

  public trackResourceUsage(cpuPercent: number, memPercent: number) {
    if (cpuPercent > 85 || memPercent > 85) {
      if (!this.resourceThresholdStartedAt) {
        this.resourceThresholdStartedAt = Date.now();
      } else if (Date.now() - this.resourceThresholdStartedAt > 5 * 60 * 1000) {
        logger.warn(`[MONITOR] High resource usage detected (>85%) for over 5 minutes!`);
        eventBus.emit('RESOURCE_THRESHOLD_EXCEEDED', { cpu: cpuPercent, mem: memPercent, durationMs: Date.now() - this.resourceThresholdStartedAt });
        // Reset to avoid spamming every tick, wait for it to clear or another 5 min.
        this.resourceThresholdStartedAt = Date.now(); 
      }
    } else {
      this.resourceThresholdStartedAt = null; // reset if it drops below threshold
    }
  }

  public reportError(error: Error | string) {
    this.health.status = SystemStatus.DEGRADED;
    this.health.lastError = typeof error === 'string' ? error : error.message;
    
    logger.error(`System ${this.health.status}: ${this.health.lastError}`);
  }

  public getHealthData(): SystemHealth {
    return { ...this.health };
  }

  private startSelfAudit() {
    setInterval(() => {
      if (this.health.status === SystemStatus.DEGRADED) {
        logger.info('Attempting self-recovery of stateful services...');
        this.health.status = SystemStatus.OPTIMAL;
      }
    }, 60000);
  }
}

export const monitor = new MonitorService();
