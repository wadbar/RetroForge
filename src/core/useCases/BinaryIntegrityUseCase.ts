import { logger } from "../../services/loggerService";

/**
 * BinaryIntegrityUseCase - Industrial verification of binary blobs.
 * Prevents corruption and identifies mismatching versions.
 */
export class BinaryIntegrityUseCase {
  /**
   * Simple and fast CRC32 implementation for binary blobs.
   */
  public static calculateCRC32(data: Uint8Array): string {
    let crc = 0 ^ (-1);
    const table = this.getCRC32Table();

    for (let i = 0; i < data.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
    }

    return ((crc ^ (-1)) >>> 0).toString(16).toUpperCase().padStart(8, '0');
  }

  private static crc32Table: number[] | null = null;
  private static getCRC32Table(): number[] {
    if (this.crc32Table) return this.crc32Table;
    
    const table: number[] = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
      }
      table[i] = c;
    }
    this.crc32Table = table;
    return table;
  }

  /**
   * Validates if the checksum matches.
   */
  public static verify(data: Uint8Array, expectedChecksum: string): boolean {
    const actual = this.calculateCRC32(data);
    const isValid = actual === expectedChecksum.toUpperCase();
    if (!isValid) {
      logger.warn(`[INTEGRITY] Mismatch! Expected: ${expectedChecksum}, Got: ${actual}`);
    }
    return isValid;
  }
}
