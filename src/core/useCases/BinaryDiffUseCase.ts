/**
 * BinaryDiffUseCase - Calculates changes between two binary buffers.
 * Essential for generating IPS/BPS patches and visualizing modifications.
 */
export interface DiffChunk {
  offset: number;
  original: Uint8Array;
  modified: Uint8Array;
}

export class BinaryDiffUseCase {
  /**
   * Compares two buffers and returns a list of differing chunks.
   */
  public static execute(original: Uint8Array, modified: Uint8Array): DiffChunk[] {
    if (original.length !== modified.length) {
      throw new Error("Buffers must have the same length for simple diffing.");
    }

    const diffs: DiffChunk[] = [];
    let i = 0;

    while (i < original.length) {
      if (original[i] !== modified[i]) {
        const start = i;
        // Group consecutive differences
        while (i < original.length && original[i] !== modified[i]) {
          i++;
        }
        
        diffs.push({
          offset: start,
          original: original.slice(start, i),
          modified: modified.slice(start, i)
        });
      } else {
        i++;
      }
    }

    return diffs;
  }

  /**
   * Generates a summary text of the diff.
   */
  public static summarize(diffs: DiffChunk[]): string {
    const totalBytes = diffs.reduce((acc, d) => acc + d.modified.length, 0);
    return `Binary Diff: ${diffs.length} chunks affected, ${totalBytes} total bytes modified.`;
  }
}
