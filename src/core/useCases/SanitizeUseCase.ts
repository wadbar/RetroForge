import { logger } from "../../services/loggerService";

/**
 * SanitizeUseCase - Centralized input sanitization for binary and text operations.
 * Prevents injection and buffer overflow patterns at the application layer.
 */
export class SanitizeUseCase {
  /**
   * Sanitizes a string for use in AI prompts or file paths.
   */
  public static text(input: string, maxLength = 1000): string {
    if (!input) return "";
    
    // Remove control characters and limit length
    const clean = input.replace(/[\x00-\x1F\x7F]/g, "").substring(0, maxLength);
    
    if (clean !== input) {
        logger.warn(`Input sanitized: original length ${input.length}, new length ${clean.length}`);
    }
    
    return clean;
  }

  /**
   * Validates a hex string pattern.
   */
  public static hex(input: string): string {
    return input.replace(/[^0-9a-fA-F? ]/g, "");
  }

  /**
   * Ensures an offset is within safe bounds.
   */
  public static offset(offset: number, max: number): number {
    if (isNaN(offset)) return 0;
    return Math.max(0, Math.min(offset, max));
  }
}
