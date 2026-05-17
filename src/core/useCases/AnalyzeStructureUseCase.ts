import { logger } from "../../services/loggerService";
import { ai } from "../../services/aiDecompilerService";

/**
 * AnalyzeStructureUseCase - Industrial AI-powered structural discovery.
 * Identifies structs, arrays, and pointer tables in raw binary data.
 */
export class AnalyzeStructureUseCase {
  /**
   * Attempts to identify data patterns in a memory slice.
   */
  public static async execute(
    data: Uint8Array, 
    offset: number, 
    arch: string = "Generic"
  ): Promise<string> {
    const hexSlice = Array.from(data.slice(0, 512))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');

    logger.info(`[ANALYSIS] Deep scanning structure at 0x${offset.toString(16)}...`);

    const prompt = `
      VOCÊ É UM ANALISTA DE RE-ENGINEERING DE DADOS BINÁRIOS.
      ARQUITETURA: ${arch}
      OFFSET INICIAL: 0x${offset.toString(16)}
      HEX DATA (512 bytes):
      ${hexSlice}

      TAREFA:
      1. Identifique se existe uma estrutura repetitiva (Array of Structs).
      2. Sugira a definição da Struct em C++ se identificar campos (Ponteiros, Inteiros, Floats, Strings).
      3. Identifique possíveis tabelas de ponteiros (Pointer Tables/Jump Tables).
      
      RETORNE APENAS A DEFINIÇÃO C++ E UMA BREVE EXPLICAÇÃO TÉCNICA.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt
      });
      return response.text || "// No structure pattern recognized.";
    } catch (error) {
      logger.error("[ANALYSIS] Structure analysis failed", error);
      throw error;
    }
  }
}
