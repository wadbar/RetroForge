import { GoogleGenAI } from "@google/genai";
import { monitor } from "./monitorService";
import { eventBus } from "./eventBus";
import { ArchType, DecompContext } from "../core/types";
import { logger } from "./loggerService";
import { lruCache } from "./lruCache";

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const LOCAL_AI_ENDPOINT = process.env.VITE_LOCAL_AI_URL || "";

export const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });

const ARCH_HINTS: Record<ArchType, string> = {
  'MIPS_R3000': 'MIPS R3000 (PS1/N64): MUITO IMPORTANTE: Respeite os "Branch Delay Slots". Registradores: $zero (sempre 0), $ra (return address), $sp (stack pointer).',
  'M68000': 'Motorola 68000 (Genesis/Amiga): Big-Endian. Registradores D0-D7 (dados) e A0-A7 (endereços).',
  'SH2': 'SuperH-2 (Saturn): RISC 32-bits, instruções 16-bits.',
  'PPC': 'PowerPC (GameCube/Wii): Big-Endian, muitos GPRs, FPU dedicado.',
  'ARM_THUMB': 'ARM/Thumb (GBA/DS): Instruções Thumb de 16-bits misturadas a ARM 32-bit. R13=SP, R14=LR, R15=PC.',
  'Z80': 'Zilog Z80 (SMS/Master System): Little-Endian, 8-bits. Registradores HL, DE, BC como pares.',
  'MOS6502': 'MOS 6502 (NES/C64): Little-Endian, 8-bits. Acumulador A, índices X, Y.',
  'x86': 'Intel x86 (PC/DOS): Little-Endian, 32-bits. Registradores EAX, EBX, ECX, EDX, ESI, EDI, EBP, ESP.',
  'x86_64': 'Intel x86_64 (Modern PC): Little-Endian, 64-bits. Registradores RAX, RBX, RCX, RDX, RSI, RDI, RBP, RSP e R8-R15.'
};

/**
 * Executes a function with exponential backoff retry logic and LRU caching.
 */
async function withRetry<T>(fn: () => Promise<T>, operationName: string, cacheKey?: string, maxRetries = 3): Promise<T> {
  if (cacheKey) {
    const cached = lruCache.get(cacheKey);
    if (cached) {
      logger.info(`[CACHE] Hit for ${operationName}`);
      return cached as T;
    }
  }

  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const start = performance.now();
      const result = await fn();
      monitor.recordMetric(operationName, performance.now() - start, false);
      if (cacheKey) lruCache.set(cacheKey, result, 3600000); // 1h cache
      return result;
    } catch (error) {
      attempt++;
      const isLastAttempt = attempt === maxRetries;
      monitor.recordMetric(operationName, 0, true);
      
      if (isLastAttempt) {
        logger.fatal(`[CRITICAL] AI operation ${operationName} failed after ${maxRetries} attempts.`);
        throw error;
      }

      const delay = Math.pow(2, attempt) * 1000;
      logger.warn(`[RETRY] ${operationName} failed (Attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error(`Execution failed for ${operationName}`);
}

/**
 * Performs a semantic analysis identifying purpose and generating C++ pseudo-code.
 */
export async function deepAnalyzeWithAI(asm: string, arch: ArchType, settings?: any): Promise<string> {
  const cacheKey = `deep:${arch}:${asm.substring(0, 500)}`;
  return withRetry(async () => {
    logger.info(`[AI] Deep Analyzing ${arch}...`);
    const response = await fetch('/api/deep-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asm, platform: arch, settings })
    });
    if (!response.ok) throw new Error('Network error during deep analysis');
    const data = await response.json();
    return data.analysis || "// No analysis.";
  }, "AI_DEEP_ANALYSIS", cacheKey);
}

/**
 * Translates a set of strings using AI, considering platform and character limits.
 */
export async function translateStringsWithAI(strings: string[], platform: string, targetLanguage: string, settings?: any): Promise<any> {
  return withRetry(async () => {
    const response = await fetch('/api/translate-strings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strings, platform, targetLanguage, settings })
    });
    if (!response.ok) throw new Error('Network error during string translation');
    return await response.json();
  }, "AI_STRING_TRANSLATION");
}

/**
 * Performs a deep forensic scan of binary data.
 */
export async function deepScanWithAI(hexSample: string, platform: string, settings?: any): Promise<string> {
  return withRetry(async () => {
    const response = await fetch('/api/deep-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hexSample, platform, settings })
    });
    if (!response.ok) throw new Error('Network error during deep scan');
    const data = await response.json();
    return data.analysis || "Nenhuma análise detalhada disponível.";
  }, "AI_DEEP_SCAN");
}

/**
 * Specifically extracts function signatures from assembly.
 */
export async function extractSignatureWithAI(asm: string, arch: ArchType, settings?: any): Promise<string> {
  return withRetry(async () => {
    const response = await fetch('/api/extract-signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asm, platform: arch, settings })
    });
    if (!response.ok) throw new Error('Network error during signature extraction');
    const data = await response.json();
    return data.analysis || "// No signature found.";
  }, "AI_SIGNATURE_EXTRACTION");
}

/**
 * Scans a binary hex stream for known signatures using AI.
 */
export async function scanWithYaraAI(hex: string, arch: ArchType, settings?: any): Promise<string> {
  return withRetry(async () => {
    logger.info(`[AI] YARA-style scan for ${arch}...`);
    const response = await fetch('/api/yara-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hex, platform: arch, settings })
    });
    if (!response.ok) throw new Error('Network error during signature scan');
    const data = await response.json();
    return data.analysis || "// No signatures found.";
  }, "AI_YARA_SCAN");
}

/**
 * Decompiles raw Assembly into high-level C++ using AI logic.
 */
export async function decompileWithAI(asm: string, context: DecompContext, settings?: any): Promise<string> {
  return withRetry(async () => {
    logger.info(`[AI] Decompiling ${context.arch}...`);
    const response = await fetch('/api/decompile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        asm, 
        intent: context.intent, 
        arch: context.arch, 
        hint: ARCH_HINTS[context.arch],
        settings 
      })
    });
    if (!response.ok) throw new Error('Network error during decompilation');
    const data = await response.json();
    eventBus.emit("AI_ANALYSIS_COMPLETE", { type: 'decomp', arch: context.arch });
    return data.analysis || "// No response.";
  }, "AI_DECOMPILE");
}

/**
 * Generates a byte-perfect patch for targeted architecture based on mod intent.
 */
export interface PatchContext {
  intent: string;
  targetAddress: string;
  arch: ArchType;
}

export async function generatePatchWithAI(asm: string, context: PatchContext, settings?: any): Promise<string> {
  const { intent, targetAddress, arch } = context;
  
  return withRetry(async () => {
    logger.info(`[AI] Generating Patch for ${arch} at ${targetAddress}...`);
    try {
      const response = await fetch('/api/generate-patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          asm, 
          intent, 
          targetAddress, 
          platform: arch,
          settings 
        })
      });
      if (!response.ok) throw new Error('Network error');
      const data = await response.json();
      return data.patch || "// No patch generated.";
    } catch (error) {
      console.error(error);
      return "**Erro de Comunicação com a IA ao gerar patch.**";
    }
  }, "AI_PATCH_GEN");
}

/**
 * Analyzes binary patterns to detect TBL or custom encodings.
 */
export async function analyzeEncodingWithAI(sampleHex: string, strings: string[], settings?: any): Promise<any> {
  return withRetry(async () => {
    logger.info(`[AI] Analyzing TBL Encoding...`);
    const response = await fetch('/api/analyze-tbl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sampleHex, strings, settings })
    });
    if (!response.ok) throw new Error('Network error during TBL analysis');
    const data = await response.json();
    let tblJson = data.analysis;
    if (typeof tblJson === 'string') {
       try { tblJson = JSON.parse(tblJson); } catch (e) {}
    }
    return tblJson || { table: {} };
  }, "AI_ENCODING_ANALYSIS");
}

/**
 * Explains the purpose of each opcode in the context of static recompilation.
 */
export async function analyzeAssemblyWithAI(asm: string, platform: string, settings?: any): Promise<string> {
  return withRetry(async () => {
    logger.info(`[AI] Analyzing Assembly for ${platform}...`);
    try {
      const response = await fetch('/api/analyze-asm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asm, platform, settings })
      });
      if (!response.ok) throw new Error('Network error');
      const data = await response.json();
      return data.analysis || "// No analysis generated.";
    } catch (error) {
      console.error(error);
      return "**Erro de Comunicação com a IA (Backend)**";
    }
  }, "AI_ASM_ANALYSIS");
}
export async function compileASMWithAI(asm: string, targetArch: ArchType, settings?: any): Promise<string> {
  return withRetry(async () => {
    const response = await fetch('/api/compile-asm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asm, arch: targetArch, settings })
    });
    if (!response.ok) throw new Error('Network error during ASM compilation');
    const data = await response.json();
    const hex = data.hex || "ERROR";
    if (hex === "ERROR") throw new Error("AI indicated syntax error in ASM.");
    return hex;
  }, "AI_COMPILATION");
}

/**
 * Refactors ASM code by adding comments and standardizing formatting via AI.
 */
export async function refactorASMWithAI(asm: string, arch: ArchType, settings?: any): Promise<string> {
  return withRetry(async () => {
    const response = await fetch('/api/refactor-asm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asm, arch, settings })
    });
    if (!response.ok) throw new Error('Network error during ASM refactoring');
    const data = await response.json();
    return data.refactored || asm;
  }, "AI_ASM_REFACTOR");
}

/**
 * Analyzes call patterns and visualizes the call stack hierarchy.
 */
export async function analyzeCallStackWithAI(code: string, platform: string, settings?: any): Promise<string> {
  return withRetry(async () => {
    logger.info(`[AI] Analyzing Call Stack for ${platform}...`);
    try {
      const response = await fetch('/api/analyze-callstack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, platform, settings })
      });
      if (!response.ok) throw new Error('Network error');
      const data = await response.json();
      return data.analysis || "// No analysis generated.";
    } catch (error) {
      console.error(error);
      return "**Erro de Comunicação com a IA ao analisar call stack.**";
    }
  }, "AI_CALLSTACK_ANALYSIS");
}

/**
 * Suggests High-Level Emulation function names for a hex block.
 */
export async function suggestHLEWithAI(hex: string, platform: string, settings?: any): Promise<string> {
  return withRetry(async () => {
    logger.info(`[AI] Fetching HLE suggestions for ${platform}...`);
    try {
      const response = await fetch('/api/hle-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hex, platform, settings })
      });
      const data = await response.json();
      return data.analysis || "// No HLE data found.";
    } catch (e) {
      return "**Erro na tradução HLE.**";
    }
  }, "AI_HLE_SUGGEST");
}

/**
 * Suggests a hook point and zero-damage hook logic for a given ASM context.
 */
export async function suggestHookPointWithAI(asmContext: string, platform: string, settings?: any): Promise<string> {
  return withRetry(async () => {
    logger.info(`[AI] Fetching Hook Point suggestions for ${platform}...`);
    try {
      const response = await fetch('/api/hook-point', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asmContext, platform, settings })
      });
      const data = await response.json();
      return data.analysis || "// No hook suggestions found.";
    } catch (e) {
      return "**Erro ao gerar hook point.**";
    }
  }, "AI_HOOK_SUGGEST");
}

/**
 * Advanced tool for deciphering algorithms, constants and crypto patterns.
 */
export async function advancedDecipherWithAI(data: string, platform: string, mode: "crypto_scan" | "entropy_analysis" | "brute_force_logic", settings?: any): Promise<string> {
  return withRetry(async () => {
    logger.info(`[AI] Deciphering data (${mode}) for ${platform}...`);
    try {
      const response = await fetch('/api/advanced-decipher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, platform, mode, settings })
      });
      if (!response.ok) throw new Error('Network error');
      const resData = await response.json();
      return resData.analysis || "// No decipher data generated.";
    } catch (error) {
      console.error(error);
      return "**Erro de Comunicação com a IA ao decifrar dados.**";
    }
  }, "AI_ADVANCED_DECIPHER");
}

/**
 * Scans binary data for known engine, compression or crypto signatures.
 */
export async function scanSignaturesWithAI(data: string, platform: string, settings?: any): Promise<string> {
  return withRetry(async () => {
    logger.info(`[AI] Scanning signatures for ${platform}...`);
    try {
      const response = await fetch('/api/scan-signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, platform, settings })
      });
      const resData = await response.json();
      return resData.analysis || "// No signatures identified.";
    } catch (e) {
      return "**Erro ao escanear assinaturas.**";
    }
  }, "AI_SIGNATURE_SCAN");
}

/**
 * Guides the user through a symbolic execution of a code block.
 */
export async function symbolicExecutionAssistant(code: string, state: any, platform: string, settings?: any): Promise<string> {
  return withRetry(async () => {
    logger.info(`[AI] Launching Symbolic Execution Assistant for ${platform}...`);
    try {
      const response = await fetch('/api/symbolic-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state, platform, settings })
      });
      const resData = await response.json();
      return resData.analysis || "// No analysis generated.";
    } catch (e) {
      return "**Erro no Assistente Simbólico.**";
    }
  }, "AI_SYMBOLIC_EXECUTION");
}

/**
 * Injects industrial-grade knowledge into the current environment.
 */
export async function injectKnowledgeV9(topic: string, context: any, settings?: any): Promise<string> {
  return withRetry(async () => {
    logger.info(`[V9] Injecting knowledge for ${topic}...`);
    const response = await fetch('/api/knowledge-injection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, context, settings })
    });
    if (!response.ok) throw new Error('Network error during knowledge injection');
    const data = await response.json();
    return data.documentation || "// Injection failed.";
  }, "AI_KNOWLEDGE_INJECTION");
}

