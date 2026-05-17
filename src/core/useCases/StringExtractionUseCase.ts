import { TranslatedString } from "../types";
import { logger } from "../../services/loggerService";

/**
 * StringExtractionUseCase - Encapsulates logic for text extraction from binary buffers.
 * This is a core domain service following Clean Architecture.
 */
export class StringExtractionUseCase {
  private static readonly CHUNK_SIZE = 64 * 1024;
  private static readonly MAX_STRINGS = 2000;
  private static readonly PRINTABLE_REGEX = /[\x20-\x7E\n\r]{6,}/g;

  /**
   * Extracts strings from a Uint8Array buffer.
   * @param data The binary data to analyze.
   * @returns Array of TranslatedString objects.
   */
  public static execute(data: Uint8Array): TranslatedString[] {
    const extracted: TranslatedString[] = [];
    const decoder = new TextDecoder('utf-8', { fatal: false });
    
    logger.info(`Starting string extraction on buffer of size ${data.length} bytes`);

    for (let offset = 0; offset < data.length && extracted.length < this.MAX_STRINGS; offset += this.CHUNK_SIZE) {
      const chunk = data.subarray(offset, Math.min(offset + this.CHUNK_SIZE + 100, data.length));
      const text = decoder.decode(chunk);
      
      let match;
      while ((match = this.PRINTABLE_REGEX.exec(text)) !== null) {
        if (extracted.length >= this.MAX_STRINGS) break;
        
        const foundText = match[0];
        const matchOffset = offset + match.index;

        // Domain Filters
        if (this.isValidString(foundText)) {
          const id = `0x${matchOffset.toString(16).toUpperCase().padStart(6, '0')}`;
          
          // Deduplication for overlapping chunks
          if (extracted.some(s => s.id === id)) continue;

          extracted.push({
            id,
            original: foundText,
            translation: '',
            status: 'pending',
            key: `STR_${matchOffset.toString(16).toUpperCase()}`
          });
        }
      }
    }
    
    logger.info(`Extraction complete. Identified ${extracted.length} valid string candidates.`);
    return extracted;
  }

  private static isValidString(text: string): boolean {
    const uniqueChars = new Set(text).size;
    const hasLetters = /[a-zA-Z]/.test(text);
    const isLowEntropy = uniqueChars < 4 && text.length > 20;
    const isGarbage = /[\x20-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]{4,}/.test(text);

    return uniqueChars > 3 && hasLetters && !isLowEntropy && !isGarbage;
  }
}
