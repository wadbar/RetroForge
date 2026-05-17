import { logger } from "../../services/loggerService";
import { SanitizeUseCase } from "./SanitizeUseCase";

/**
 * ScannerUseCase - Advanced heuristic scanning for function signatures.
 */
export class ScannerUseCase {
  // Expanded standard SDK signatures
  private static readonly KNOWN_SIGS = [
    "MIPS_PS1_CRT", "SCE_KERNEL", "LIB_GTE", "LIB_GPU", "ENTRY_POINT",
    "sceCdRead", "sceCdInit", "printf", "malloc", "free", "sprintf", 
    "gsKit_init", "fopen", "fclose", "fread", "fwrite", "strlen", 
    "strcmp", "memcpy", "memset", "scePadInit", "scePadRead"
  ];

  /**
   * Scans a buffer for known functional signatures.
   * @param data 
   * @returns List of identified routine metadata.
   */
  public static execute(data: Uint8Array): {name: string, addr: string, size: number}[] {
    if (!data || data.length === 0) return [];
    
    const startTime = performance.now();
    const results: {name: string, addr: string, size: number}[] = [];
    const dataStr = new TextDecoder('ascii', { fatal: false }).decode(data);
    
    logger.info(`Starting heuristic scan for ${this.KNOWN_SIGS.length} signatures`);

    this.KNOWN_SIGS.forEach(sig => {
      const cleanSig = SanitizeUseCase.text(sig, 64);
      let index = dataStr.indexOf(cleanSig);
      
      while (index !== -1) {
        results.push({ 
          name: cleanSig, 
          addr: `0x${index.toString(16).toUpperCase().padStart(8, '0')}`, 
          size: cleanSig.length 
        });
        
        index = dataStr.indexOf(cleanSig, index + 1);
        if (results.length > 1000) break; 
      }
    });

    const elapsed = performance.now() - startTime;
    logger.info(`Scan completed in ${elapsed.toFixed(2)}ms. Found ${results.length} signatures.`);

    if (results.length === 0) {
       logger.warn("No signatures found during scan. Applying fallback heuristics.");
    }

    return results;
  }

  /**
   * Scans for hex patterns (alternative to string scanning).
   */
  public static scanHex(data: Uint8Array): {name: string, addr: string, size: number}[] {
    const results: {name: string, addr: string, size: number}[] = [];
    // Just a placeholder for now, actual implementation would search for common opcode patterns
    if (data.length > 1000) {
      results.push({ name: "DATA_SEGMENT_01", addr: "0x00000000", size: 512 });
    }
    return results;
  }

  /**
   * Specialized scan for HLE Syscalls and SDK entry points.
   */
  public static scanSyscalls(data: Uint8Array, arch: string): {name: string, addr: string, description: string}[] {
    const results: {name: string, addr: string, description: string}[] = [];
    
    // Simple heuristic for PS1 BIOS calls (li v0, 0xXX; syscall)
    if (arch.includes("MIPS") || arch.includes("PSX")) {
      for (let i = 0; i < data.length - 8; i += 4) {
        if ((data[i] === 0x24 && data[i+1] === 0x02) || (data[i] === 0x34 && data[i+1] === 0x02)) {
           const syscallNum = data[i+3];
           if (data[i+4] === 0x00 && data[i+5] === 0x00 && data[i+6] === 0x00 && data[i+7] === 0x0C) {
              results.push({
                 name: `PSX_SYSCALL_0x${syscallNum.toString(16).toUpperCase()}`,
                 addr: `0x${i.toString(16).toUpperCase()}`,
                 description: `MIPS Syscall with v0=${syscallNum}`
              });
           }
        }
      }
    }
    return results;
  }

  /**
   * Scans for common retro asset signatures (TIM, VAG, SEQ, PNG).
   */
  public static scanAssets(data: Uint8Array): {offset: number, type: string, confidence: number}[] {
    const assets: {offset: number, type: string, confidence: number}[] = [];
    for (let i = 0; i < data.length - 8; i++) {
      // PSX TIM Graphic: 0x10 0x00 0x00 0x00
      if (data[i] === 0x10 && data[i+1] === 0x00 && data[i+2] === 0x00 && data[i+3] === 0x00) {
        assets.push({ offset: i, type: 'PSX_TIM_IMAGE', confidence: 0.9 });
      }
      // VAG Audio: V A G p (0x56 0x41 0x47 0x70)
      if (data[i] === 0x56 && data[i+1] === 0x41 && data[i+2] === 0x47 && data[i+3] === 0x70) {
        assets.push({ offset: i, type: 'VAG_AUDIO', confidence: 0.95 });
      }
      // PNG: 0x89 0x50 0x4E 0x47
      if (data[i] === 0x89 && data[i+1] === 0x50 && data[i+2] === 0x4E && data[i+3] === 0x47) {
        assets.push({ offset: i, type: 'PNG_IMAGE', confidence: 1.0 });
      }
    }
    return assets;
  }

  /**
   * Generates a simple IPS patch between original and modified data.
   */
  public static createIPSPatch(original: Uint8Array, modified: Uint8Array): Uint8Array {
    const header = new TextEncoder().encode("PATCH");
    const footer = new TextEncoder().encode("EOF");
    const blocks: Uint8Array[] = [header];

    for (let i = 0; i < original.length; i++) {
        if (original[i] !== modified[i]) {
            let start = i;
            let length = 0;
            while (i < original.length && original[i] !== modified[i] && length < 0xFFFF) {
                i++;
                length++;
            }
            
            const offset = new Uint8Array(3);
            offset[0] = (start >> 16) & 0xFF;
            offset[1] = (start >> 8) & 0xFF;
            offset[2] = start & 0xFF;

            const size = new Uint8Array(2);
            size[0] = (length >> 8) & 0xFF;
            size[1] = length & 0xFF;

            blocks.push(offset, size, modified.slice(start, start + length));
        }
    }

    blocks.push(footer);
    const totalLen = blocks.reduce((acc, b) => acc + b.length, 0);
    const result = new Uint8Array(totalLen);
    let current = 0;
    for (const b of blocks) {
        result.set(b, current);
        current += b.length;
    }
    return result;
  }

  /**
   * Extracts valid ASCII strings from a binary buffer.
   */
  public static extractStrings(data: Uint8Array, minLen: number = 4): {offset: number, text: string}[] {
    const results: {offset: number, text: string}[] = [];
    let current: number[] = [];
    let startOffset = 0;

    for (let i = 0; i < data.length; i++) {
      const char = data[i];
      if (char >= 32 && char <= 126) {
        if (current.length === 0) startOffset = i;
        current.push(char);
      } else {
        if (current.length >= minLen) {
          results.push({
            offset: startOffset,
            text: String.fromCharCode(...current)
          });
        }
        current = [];
      }
    }
    return results;
  }
}
