/**
 * ResilientAiCore.ts
 * 
 * Motor de Inteligência Artificial agnóstico, universal e blindado contra falhas.
 * Implementa os padrões Strategy, Fallback e Circuit Breaker para máxima disponibilidade.
 * 
 * @author Arquiteto de Software Principal
 * @version 1.0.0
 */

import { GoogleGenAI } from "@google/genai";

// Tipagens do Sistema
export type AIProvider = 'ollama' | 'gemini' | 'nvidia';
export type ResponseType = 'text' | 'json';

export interface AIConfig {
  prompt: string;
  systemInstruction?: string;
  responseType?: ResponseType;
  temperature?: number;
  settings?: any;
}

export interface AIResult {
  success: boolean;
  provider: AIProvider;
  model: string;
  content: string | any;
  timestamp: string;
  latencyMs: number;
  error?: string;
}

/**
 * Classe Core Resiliente de IA
 */
export class ResilientAiCore {
  
  /**
   * Ponto de entrada universal para geração de conteúdo
   */
  public static async generate(config: AIConfig): Promise<AIResult> {
    const startTime = Date.now();
    let { 
      prompt, 
      systemInstruction = 'Você é um assistente técnico especialista.', 
      responseType = 'text', 
      temperature = 0.7,
      settings
    } = config;

    if (settings?.projectContext) {
      const pc = settings.projectContext;
      const contextStr = `\n\n=== CONTEXTO DO PROJETO ===\n- Arquivo Alvo: ${pc.fileName} (${(pc.fileSize / 1024).toFixed(2)} KB)\n- Arquitetura Alvo: ${pc.targetArch}\n- Objetivo Atual do Mod: ${pc.modIntent || 'Nenhum'}\n- Símbolos Mapeados: ${pc.symbolsDetected}\n- Strings Detectadas: ${pc.detectedStrings?.join(', ')}\n- Ações Recentes: ${pc.recentActions?.join(' | ')}\n===========================\n`;
      prompt = `${prompt}${contextStr}`;
      console.log("[AI-CORE] Contexto de projeto injetado no prompt.");
    }

    console.log(`\n[AI-CORE-MONITOR] [${new Date().toISOString()}] Iniciando requisição de IA...`);

    // Pipeline de Execução Inteligente (AI Studio vs Outros)
    const isAiStudio = process.env.DISABLE_HMR === 'true'; // Flag nativa do AI Studio Dev Server
    const providers: AIProvider[] = isAiStudio 
      ? ['gemini'] 
      : ['ollama', 'gemini', 'nvidia'];

    if (isAiStudio) {
      console.log(`[AI-CORE-NATIVE] Ambiente AI Studio detectado. Redirecionando poder computacional primário para Gemini Nativo...`);
    } else {
      console.log(`[AI-CORE-LOCAL] Ambiente externo detectado. Iniciando pipeline tático (Ollama -> Gemini -> Nvidia)...`);
    }

    for (const provider of providers) {
      try {
        let result: Partial<AIResult>;
        if (provider === 'gemini') {
          result = await this.tryGemini(prompt, systemInstruction, temperature, startTime);
        } else if (provider === 'ollama') {
          result = await this.tryOllama(prompt, systemInstruction, temperature, startTime);
        } else {
          result = await this.tryNvidia(prompt, systemInstruction, temperature, startTime);
        }
        return this.validateAndFormat(result, responseType);
      } catch (error: any) {
        this.logFailure(provider.toUpperCase(), error.message);
      }
    }

    // FAIAL TOTAL
    console.error(`[AI-CORE-CRITICAL] [${new Date().toISOString()}] Shutdown: Todos os provedores falharam.`);
    throw new Error('MOTOR_IA_INDISPONIVEL: Falha em todas as rotas de contingência.');
  }

  /**
   * Implementação Ollama (Local)
   */
  private static async tryOllama(prompt: string, system: string, temp: number, start: number): Promise<Partial<AIResult>> {
    const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';

    console.log(`[AI-CORE-LEVEL-1] Tentando Ollama em ${host} com modelo ${model}...`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s para local

    try {
      const response = await fetch(`${host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          system,
          prompt,
          template: prompt, // Algumas versões do Ollama preferem template para prompts complexos
          stream: false,
          options: { temperature: temp }
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) throw new Error(`HTTP_${response.status}`);

      const data = await response.json();
      return {
        success: true,
        provider: 'ollama',
        model,
        content: data.response,
        latencyMs: Date.now() - start
      };
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  }

  /**
   * Implementação Google Gemini (Cloud)
   */
  private static async tryGemini(prompt: string, system: string, temp: number, start: number, retries = 2): Promise<Partial<AIResult>> {
    const apiKey = process.env.GEMINI_API_KEY;
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    if (!apiKey) throw new Error('API_KEY_MISSING');

    console.log(`[AI-CORE-LEVEL-2] Tentando Google Gemini com modelo ${modelName}...`);
    
    let lastError = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const genAI = new GoogleGenAI({ apiKey: apiKey });
        // Implementing simple abort controller logic wrapper for Gemini via promise race
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout
        
        const resultPromise = genAI.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction: system,
            temperature: temp
          }
        });
        
        const abortPromise = new Promise((_, reject) => {
          controller.signal.addEventListener('abort', () => reject(new Error('GEMINI_TIMEOUT_ABORT')));
        });
        
        const result: any = await Promise.race([resultPromise, abortPromise]);
        clearTimeout(timeoutId);

        const text = result.text;
        if (!text) throw new Error('EMPTY_RESPONSE');

        return {
          success: true,
          provider: 'gemini',
          model: modelName,
          content: text,
          latencyMs: Date.now() - start
        };
      } catch (err: any) {
        lastError = err;
        console.warn(`[AI-CORE-RETRY] Gemini Falhou na tentativa ${attempt}. ${err.message}`);
        if (attempt < retries) {
          await new Promise(res => setTimeout(res, 500 * Math.pow(2, attempt))); // Exponential backoff
        }
      }
    }
    throw lastError;
  }

  /**
   * Implementação NVIDIA NIM (Performance)
   */
  private static async tryNvidia(prompt: string, system: string, temp: number, start: number, retries = 2): Promise<Partial<AIResult>> {
    const apiKey = process.env.NVIDIA_API_KEY;
    const model = process.env.NVIDIA_MODEL || 'meta/llama-3.1-405b-instruct';
    const baseUrl = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';

    if (!apiKey) throw new Error('API_KEY_MISSING');

    console.log(`[AI-CORE-LEVEL-3] Tentando NVIDIA NIM com modelo ${model}...`);

    let lastError = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000); // 20s timeout

      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: prompt }
            ],
            temperature: temp,
            max_tokens: 4096
          }),
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) throw new Error(`HTTP_${response.status}`);

        const data = await response.json();
        return {
          success: true,
          provider: 'nvidia',
          model,
          content: data.choices[0].message.content,
          latencyMs: Date.now() - start
        };
      } catch (err: any) {
        clearTimeout(timeout);
        lastError = err;
        console.warn(`[AI-CORE-RETRY] NVIDIA Falhou na tentativa ${attempt}. ${err.message}`);
        if (attempt < retries) {
          await new Promise(res => setTimeout(res, 500 * Math.pow(2, attempt))); // Exponential backoff
        }
      }
    }
    throw lastError;
  }

  /**
   * Validador e Formatador de Saída com Anti-Alucinação
   */
  private static validateAndFormat(result: Partial<AIResult>, type: ResponseType): AIResult {
    let content = result.content;

    // Sanitização para modo JSON
    if (type === 'json' && typeof content === 'string') {
      try {
        // Limpeza de blocos de código markdown (```json ... ```)
        const jsonMatch = content.match(/```json\s?([\s\S]*?)```/) || 
                         content.match(/```\s?([\s\S]*?)```/);
        
        const cleanJson = jsonMatch ? jsonMatch[1].trim() : content.trim();
        content = JSON.parse(cleanJson);
      } catch (e) {
        console.warn(`[AI-CORE-WARNING] Falha no parse JSON da ${result.provider}. Tentando fallback de processamento...`);
        throw new Error('INVALID_JSON_HALLUCINATION');
      }
    }

    const finalResult: AIResult = {
      success: true,
      provider: result.provider as AIProvider,
      model: result.model || 'unknown',
      content: content,
      timestamp: new Date().toISOString(),
      latencyMs: result.latencyMs || 0
    };

    console.log(`[AI-CORE-SUCCESS] Provedor: ${finalResult.provider.toUpperCase()} | Latência: ${finalResult.latencyMs}ms`);
    return finalResult;
  }

  /**
   * Log de falha padronizado
   */
  private static logFailure(provider: string, detail: string): void {
    const timestamp = new Date().toISOString();
    console.warn(`[AI-CORE-FALLBACK] [${timestamp}] Alerta: Provedor ${provider} falhou. Motivo: ${detail}`);
  }
}
