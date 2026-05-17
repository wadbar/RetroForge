
/**
 * SecurityUtils - Hardening layer for input sanitization and validation.
 */
export class SecurityUtils {
  /**
   * Sanitizes strings to prevent basic XSS or injection if displayed back to UI or used in shell.
   * @param input Raw input string.
   */
  public static sanitize(input: string): string {
    return input.replace(/[<>]/g, '').trim();
  }

  /**
   * Validates that an offset string is a valid hex format.
   * @param offset 
   */
  public static isValidOffset(offset: string): boolean {
    return /^0x[0-9A-Fa-f]+$/.test(offset);
  }
}

/**
 * Boyer-Moore String Search Algorithm
 * Optimized for searching patterns in large buffers with better-than-linear performance.
 * 
 * @param {string | Uint8Array} pattern - The search pattern.
 */
export class BoyerMoore {
  private badCharTable: Int32Array;
  private pattern: Uint8Array;

  constructor(pattern: string | Uint8Array) {
    this.pattern = typeof pattern === 'string' ? new TextEncoder().encode(pattern) : pattern;
    this.badCharTable = new Int32Array(256).fill(this.pattern.length);

    for (let i = 0; i < this.pattern.length - 1; i++) {
      this.badCharTable[this.pattern[i]] = this.pattern.length - 1 - i;
    }
  }

  /**
   * Performs the search on the provided data.
   * @param {Uint8Array} data - The buffer to search in.
   * @param {number} start - Starting offset.
   * @returns {number} The index of the first match or -1.
   */
  public search(data: Uint8Array, start = 0): number {
    const n = data.length;
    const m = this.pattern.length;

    if (m === 0) return 0;

    let s = start;
    while (s <= n - m) {
      let j = m - 1;

      while (j >= 0 && this.pattern[j] === data[s + j]) {
        j--;
      }

      if (j < 0) {
        return s; // Match found
      } else {
        s += Math.max(1, this.badCharTable[data[s + j]]);
      }
    }

    return -1; // No match
  }
}

/**
 * Knuth-Morris-Pratt Search Algorithm
 */
export function kmpSearch(text: string, pattern: string): number {
  if (pattern.length === 0) return 0;

  const lps = computeLPSArray(pattern);
  let i = 0; // index for text
  let j = 0; // index for pattern

  while (i < text.length) {
    if (pattern[j] === text[i]) {
      i++;
      j++;
    }

    if (j === pattern.length) {
      return i - j;
    } else if (i < text.length && pattern[j] !== text[i]) {
      if (j !== 0) {
        j = lps[j - 1];
      } else {
        i++;
      }
    }
  }

  return -1;
}

function computeLPSArray(pattern: string): number[] {
  const lps = new Array(pattern.length).fill(0);
  let len = 0;
  let i = 1;

  while (i < pattern.length) {
    if (pattern[i] === pattern[len]) {
      len++;
      lps[i] = len;
      i++;
    } else {
      if (len !== 0) {
        len = lps[len - 1];
      } else {
        lps[i] = 0;
        i++;
      }
    }
  }
  return lps;
}
