import { eventBus } from "./eventBus";
import { monitor } from "./monitorService";
import { logger } from "./loggerService";

/**
 * EventLogger - Bridges the decoupled EventBus with the Observability Monitor.
 * Realizes the "Infinite Evolution" by making system interactions measurable.
 */
export class EventLogger {
  constructor() {
    this.init();
  }

  private init() {
    // Track core interactions
    eventBus.on("SCAN_PERFORMED", (payload) => {
      logger.info(`[OBSERVABILITY] Scan performed with ${payload.resultsCount} results.`);
      monitor.trackOperation("SCAN_EVENT");
    });

    eventBus.on("PATCH_GENERATED", () => {
      monitor.trackOperation("PATCH_EVENT");
    });

    eventBus.on("AI_INTERACTION", (payload) => {
      logger.debug(`[OBSERVABILITY] AI Interaction: ${payload.type}`);
      monitor.trackOperation(`AI_${payload.type}_EVENT`);
    });

    // Error monitoring via high-level events
    eventBus.on("SYSTEM_ERROR", (payload) => {
      monitor.reportError(payload.message || "Unspecified System Error");
      logger.error(`[CRITICAL] System Error Event: ${payload.message}`, payload.error);
    });
  }
}

export const eventLogger = new EventLogger();
