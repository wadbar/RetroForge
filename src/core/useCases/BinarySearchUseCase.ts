import { BinarySearchResult } from "../types";
import { BoyerMoore } from "../../services/searchUtils";
import { logger } from "../../services/loggerService";

/**
 * BinarySearchUseCase - Core logic for high-performance pattern matching in binaries.
 */
export class BinarySearchUseCase {
  /**
   * Executes a Boyer-Moore search for a text pattern in a binary buffer.
   * @param data Binary buffer to search.
   * @param query Text pattern.
   * @returns Array of results with offsets and context snippets.
   */
  public static execute(data: Uint8Array, query: string): BinarySearchResult[] {
    if (!query || !data) return [];

    logger.info(`Executing Binary Search for pattern: "${query}"`);
    
    const results: BinarySearchResult[] = [];
    const bm = new BoyerMoore(query);
    let pos = 0;

    // Limit to top 100 results for performance
    while (results.length < 100) {
      const found = bm.search(data, pos);
      if (found === -1) break;

      const offset = `0x${found.toString(16).toUpperCase()}`;
      const snippet = new TextDecoder().decode(data.subarray(found, found + 20)).replace(/[\x00-\x1F\x7F-\xFF]/g, '.');
      
      results.push({ offset, snippet });
      pos = found + 1;
    }

    logger.debug(`Binary search finished. Found ${results.length} matches.`);
    return results;
  }
}
