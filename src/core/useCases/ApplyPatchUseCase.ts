import { logger } from "../../services/loggerService";
import { eventBus } from "../../services/eventBus";
import { snapshotService } from "../../services/snapshotService";

/**
 * ApplyPatchUseCase - Industrial logic for safely modifying binary data.
 * Implements pre-patch validation and automatic backup.
 */
export class ApplyPatchUseCase {
  /**
   * Applies a hex patch string to an ArrayBuffer.
   * Format: "AA BB CC DD"
   */
  public static async execute(
    buffer: Uint8Array, 
    hexPatch: string, 
    offsetHex: string,
    projectId: string,
    patchLabel: string
  ): Promise<Uint8Array> {
    const offset = parseInt(offsetHex, 16);
    
    if (isNaN(offset) || offset < 0 || offset >= buffer.length) {
      throw new Error(`Invalid patch offset: ${offsetHex}`);
    }

    // 1. Clean hex string
    const bytes = hexPatch.trim().split(/\s+/).map(h => parseInt(h, 16));
    
    if (bytes.some(isNaN)) {
      throw new Error("Invalid hex bytes in patch string.");
    }

    if (offset + bytes.length > buffer.length) {
      throw new Error("Patch exceeds binary boundaries.");
    }

    // 2. Automated Safety Snapshot
    logger.info(`[PATCH] Applying ${bytes.length} bytes at ${offsetHex}. Automated snapshot initiated.`);
    await snapshotService.createSnapshot(projectId, buffer, `Before: ${patchLabel}`);

    // 3. Perform Modification on a copy (Pure Function)
    const newBuffer = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) {
      newBuffer[offset + i] = bytes[i];
    }

    // 4. Feedback loop
    eventBus.emit("PATCH_APPLIED", { 
      projectId, 
      offset: offsetHex, 
      length: bytes.length,
      label: patchLabel 
    });

    return newBuffer;
  }
}
