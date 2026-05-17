import { GoogleGenAI } from "@google/genai";

/**
 * Interface para normalização de resposta das IAs
 */
export interface AIResponse {
  content: string;
  provider: "OLLAMA" | "GEMINI" | "NVIDIA";
  model: string;
  latencyMs: number;
}

/**
 * IAManager: Gerenciador Universal de IA com Fallback Automático
 * Padrão: Ollama (Local) -> Gemini (Google) -> NVIDIA (NIM)
 */
export class IAManager {
  private static async getGeminiResponse(prompt: string): Promise<string> {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY ausente.");
    
    // @ts-ignore - Dynamic import to match project pattern
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt
    });
    
    return response.text || "";
  }

  /**
   * Função Principal de Geração com Contingência (Fallback)
   */
  public static async generateResponse(prompt: string, systemInstruction: string = ""): Promise<AIResponse> {
    const startTime = Date.now();
    const fullPrompt = systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt;

    // --- PRIORIDADE 1: OLLAMA (Local/WSL2) ---
    try {
      console.log(`[PAPERCREEPER-IA] Camada 1: Ollama (${process.env.OLLAMA_MODEL})...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

      const response = await fetch(`${process.env.OLLAMA_URL || 'http://localhost:11434'}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL || "qwen2.5-coder:7b",
          prompt: fullPrompt,
          stream: false,
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data: any = await response.json();
        return {
          content: data.response,
          provider: "OLLAMA",
          model: process.env.OLLAMA_MODEL || "qwen2.5-coder:7b",
          latencyMs: Date.now() - startTime
        };
      }
      throw new Error(`Ollama retornou erro ${response.status}`);
    } catch (error: any) {
      const reason = error.name === 'AbortError' ? 'Timeout' : error.message;
      console.warn(`[RECOVERY] Ollama falhou (${reason}). Iniciando Fallback: Gemini.`);
    }

    // --- PRIORIDADE 2: GOOGLE GEMINI (Nuvem Robusta) ---
    try {
      console.log("[PAPERCREEPER-IA] Camada 2: Google Gemini...");
      const text = await this.getGeminiResponse(fullPrompt);

      if (text) {
        return {
          content: text,
          provider: "GEMINI",
          model: "gemini-1.5-flash",
          latencyMs: Date.now() - startTime
        };
      }
      throw new Error("Gemini vazio.");
    } catch (error: any) {
      console.warn(`[RECOVERY] Gemini falhou (${error.message}). Iniciando Fallback: NVIDIA NIM.`);
    }

    // --- PRIORIDADE 3: NVIDIA NIM (Nuvem Performance) ---
    try {
      if (!process.env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY ausente.");

      console.log(`[PAPERCREEPER-IA] Camada 3: NVIDIA NIM (${process.env.NVIDIA_MODEL})...`);
      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.NVIDIA_MODEL || "meta/llama-3.1-70b-instruct",
          messages: [{ role: "user", content: fullPrompt }],
          temperature: 0.5,
          max_tokens: 2048,
        }),
      });

      if (response.ok) {
        const data: any = await response.json();
        return {
          content: data.choices[0].message.content,
          provider: "NVIDIA",
          model: process.env.NVIDIA_MODEL || "llama-3.1-70b-instruct",
          latencyMs: Date.now() - startTime
        };
      }
      throw new Error(`NVIDIA status ${response.status}`);
    } catch (error: any) {
      console.error("[CRITICAL] SISTEMA IA TOTALMENTE INDISPONÍVEL.");
      throw new Error(`PaperCreeper Failure: Todas as rotas de IA falharam. Verifique logs e chaves.`);
    }
  }
}
