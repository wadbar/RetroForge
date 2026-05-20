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
   * @param tblMap Optional custom character table mapping (e.g., { 0x41: 'A' })
   * @returns Array of TranslatedString objects.
   */
  public static execute(data: Uint8Array, tblMap?: Record<number, string>): TranslatedString[] {
    const extracted: TranslatedString[] = [];
    
    logger.info(`Starting string extraction on buffer of size ${data.length} bytes${tblMap ? ' with custom TBL' : ''}`);

    if (tblMap && Object.keys(tblMap).length > 0) {
      // Byte-level extraction using TBL
      let currentString = '';
      let startOffset = -1;
      
      for (let offset = 0; offset < data.length; offset++) {
        if (extracted.length >= this.MAX_STRINGS) break;

        const byte = data[offset];
        const char = tblMap[byte];

        if (char !== undefined) {
          if (startOffset === -1) startOffset = offset;
          currentString += char;
        } else {
          // Break condition
          if (currentString.length >= 4 && this.isValidString(currentString)) {
             const id = `0x${startOffset.toString(16).toUpperCase().padStart(6, '0')}`;
             if (!extracted.some(s => s.id === id)) {
                extracted.push({
                   id,
                   original: currentString,
                   translation: '',
                   status: 'pending',
                   key: `STR_${startOffset.toString(16).toUpperCase()}`
                });
             }
          }
          currentString = '';
          startOffset = -1;
        }
      }
      return extracted;
    }

    // Default ASCII extraction extraction
    const decoder = new TextDecoder('utf-8', { fatal: false });
    for (let offset = 0; offset < data.length && extracted.length < this.MAX_STRINGS; offset += this.CHUNK_SIZE) {
      const chunk = data.subarray(offset, Math.min(offset + this.CHUNK_SIZE + 100, data.length));
      const text = decoder.decode(chunk);
      
      let match;
      while ((match = this.PRINTABLE_REGEX.exec(text)) !== null) {
        if (extracted.length >= this.MAX_STRINGS) break;
        
        const foundText = match[0];
        const matchOffset = offset + match.index;

        if (this.isValidString(foundText)) {
          const id = `0x${matchOffset.toString(16).toUpperCase().padStart(6, '0')}`;
          
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
