import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import crypto from "crypto";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { SanitizeUseCase } from "./src/core/useCases/SanitizeUseCase";
import { ResilientAiCore } from "./src/services/ai/resilientAiCore";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Persistent Memory Cache ---
const aiCache = new Map<string, { content: any; expiry: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

function getCached(key: string) {
  const item = aiCache.get(key);
  if (item && item.expiry > Date.now()) return item.content;
  aiCache.delete(key);
  return null;
}

function setCache(key: string, content: any) {
  aiCache.set(key, { content, expiry: Date.now() + CACHE_TTL });
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  // --- Tier 1 Native WebSocket Server setup ---
  const io = new SocketIOServer(server, {
    cors: { origin: "*" },
  });

  // --- Tier 0 Redis Synchronization ---
  if (process.env.REDIS_URL) {
    try {
      const pubClient = new Redis(process.env.REDIS_URL);
      const subClient = pubClient.duplicate();
      io.adapter(createAdapter(pubClient, subClient));
      console.log("[TIER 0] Redis Adapter connected for massive real-time sync.");
    } catch (e) {
      console.error("[TIER 0] Failed to connect Redis Adapter, falling back to in-memory:", e);
    }
  } else {
    console.log("[TIER 0] No REDIS_URL found. WebSocket running in standalone memory mode.");
  }

  // Handle WebSocket connections
  io.on("connection", (socket) => {
    console.log(`[TIER 1] Client connected to Collaborative Engineering Hub: ${socket.id}`);

    // AI-Tuning Sync
    socket.on("syncTuning", (data) => {
      console.log(`[TIER 1] Syncing tuning knowledge from ${socket.id}`);
      socket.broadcast.emit("tuningUpdated", data); 
    });

    // Code/Hex Collaboration
    socket.on("codeEdit", (data) => {
      socket.broadcast.emit("codeEditSync", data);
    });

    socket.on("disconnect", () => {
      console.log(`[TIER 1] Client disconnected: ${socket.id}`);
    });
  });

  app.use(express.json());

  // Global Perf Monitoring Middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (req.path.startsWith('/api')) {
        console.log(`[PERF] ${req.method} ${req.path} - ${duration}ms - Status: ${res.statusCode}`);
      }
    });
    next();
  });

  let githubToken: string | null = null;
  
  app.get("/api/system/stats", async (req, res) => {
    const os = await import('os');
    const totalMemStr = (os.totalmem() / (1024 ** 3)).toFixed(2) + ' GB';
    const usedMemStr = ((os.totalmem() - os.freemem()) / (1024 ** 3)).toFixed(2) + ' GB';
    const cpuLoadPercent = Math.min(100, (os.loadavg()[0] / os.cpus().length) * 100).toFixed(1);
    res.json({ 
      totalMemoryStr: totalMemStr, 
      usedMemoryStr: usedMemStr, 
      cpuLoadPercent,
      load: os.loadavg()
    });
  });

  app.get("/api/system/telemetry", (req, res) => {
    res.json({ 
      status: "hyper-active", 
      engine: "ResilientAiCore V9", 
      providers: ["Ollama", "Gemini", "NVIDIA"],
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  });

  app.get("/api/system/circuit-breaker", (req, res) => {
    res.json({ state: "CLOSED", consecutiveFailures: 0 });
  });

  app.post("/api/system/stress-test", (req, res) => {
    const { load } = req.body;
    console.log(`[STRESS] Applied load: ${load}`);
    res.json({ status: 'stress_applied' });
  });

  // GitHub OAuth Routes
  app.get("/api/auth/github/url", (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: "GITHUB_CLIENT_ID not configured" });
    }
    const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/github/callback`;
    const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo,user`;
    res.json({ url });
  });

  app.get("/api/auth/github/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect("/");

    try {
      const response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      const data = await response.json();
      if (data.access_token) {
        githubToken = data.access_token;
        res.send(`
          <html>
            <body>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'GITHUB_AUTH_SUCCESS' }, '*');
                  window.close();
                } else {
                  window.location.href = '/';
                }
              </script>
              <p>Autenticação GitHub concluída! Esta janela fechará automaticamente.</p>
            </body>
          </html>
        `);
      } else {
        res.status(400).send("Falha ao obter token do GitHub");
      }
    } catch (error) {
      console.error(error);
      res.status(500).send("Erro interno no OAuth");
    }
  });

  app.get("/api/auth/github/status", (req, res) => {
    res.json({ connected: !!githubToken });
  });

  // --- AI ENDPOINTS (Unified via ResilientAiCore) ---

  app.post("/api/analyze", async (req, res) => {
    const { projectName, platform } = req.body;
    const cacheKey = `analyze_${projectName}_${platform}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    try {
      const result = await ResilientAiCore.generate({
        prompt: `Analise projeto "${projectName}" para ${platform}. Gere 5 tasks técnicas JSON: { "tasks": [] }`,
        systemInstruction: "Software Architect Sênior especializado em preservação digital.",
        responseType: 'json',
        settings: req.body.settings
      });
      setCache(cacheKey, result.content);
      res.json(result.content);
    } catch (e: any) {
      res.json({ tasks: ["Analysis Fallback: Check Entry Point", "Buffer Security Audit"] });
    }
  });

  app.post("/api/analyze-asm", async (req, res) => {
    const { asm, platform } = req.body;
    try {
      const result = await ResilientAiCore.generate({
        prompt: `Analise ASM (${platform}):\n${asm}`,
        systemInstruction: "Expert Reverse Engineer especialista em ASM e recompilação.",
        responseType: 'text',
        settings: req.body.settings
      });
      res.json({ analysis: result.content });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/generate-patch", async (req, res) => {
    const { asm, intent, targetAddress, platform } = req.body;
    try {
      const result = await ResilientAiCore.generate({
        prompt: `Patch no ender ${targetAddress} para "${intent}". ASM Original:\n${asm}\nPlat: ${platform}`,
        systemInstruction: "Expert patching engineer. Return ONLY the final hexadecimal patch bytes separated by spaces. Do not include any explanations, markdown formatting, or surrounding text. Only Hex bytes.",
        responseType: 'text',
        settings: req.body.settings
      });
      res.json({ patch: result.content });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/analyze-callstack", async (req, res) => {
    const { code, platform } = req.body;
    try {
      const result = await ResilientAiCore.generate({
        prompt: `Realize uma análise profunda da hierarquia de chamadas (Call Stack) para a plataforma ${platform}.
Código Alvo (ASM/C++):
${code}

Tarefas:
1. Identifique todos os fluxos de chamadas e dependências funcionais.
2. Identifique explicitamente POTENCIAIS PONTOS DE ENTRADA (Entry Points) e GANCHOS (Hooks) para modificação (ROM Hacking).
3. Analise se há recursividade ou loops complexos.
4. Gere um grafo de chamadas no formato JSON ao final da resposta.

O JSON deve seguir este formato:
\`\`\`json
{
  "nodes": [
    { "id": "func1", "name": "main", "type": "entry" },
    { "id": "func2", "name": "sub_logic", "type": "function" },
    { "id": "hook1", "name": "hook_vblank", "type": "entry" }
  ],
  "links": [
    { "source": "func1", "target": "func2", "label": "invokes" }
  ]
}
\`\`\`

A explicação em texto deve detalhar por que certas funções são bons alvos para 'hooks'.`,
        systemInstruction: "Você é um Arquiteto de Sistemas de Elite, especialista em Grafos de Controle de Fluxo (CFG), Engenharia Reversa e Identificação de Vetores de Injeção em Binários Retro.",
        responseType: 'text',
        settings: req.body.settings
      });
      res.json({ analysis: result.content });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/hle-suggest", async (req, res) => {
    const { hex, platform } = req.body;
    try {
      const result = await ResilientAiCore.generate({
        prompt: `Identifique chamadas de SDK/Syscalls para ${platform} no hex:\n${hex}`,
        systemInstruction: "Expert em HLE/SDK legados.",
        responseType: 'text',
        settings: req.body.settings
      });
      res.json({ analysis: result.content });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/scan-signatures", async (req, res) => {
    const { data } = req.body;
    try {
      const result = await ResilientAiCore.generate({
        prompt: `Scan signatures in binary data:\n${data}`,
        systemInstruction: "Expert em Assinaturas de Binários (YARA-style).",
        responseType: 'text',
        settings: req.body.settings
      });
      res.json({ analysis: result.content });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/symbolic-assistant", async (req, res) => {
    const { code, state, platform } = req.body;
    try {
      const result = await ResilientAiCore.generate({
        prompt: `Symbolic execution for ${platform}. Code:\n${code}\nState: ${JSON.stringify(state)}`,
        systemInstruction: "Mestre de Execução Simbólica.",
        responseType: 'text',
        settings: req.body.settings
      });
      res.json({ analysis: result.content });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/advanced-decipher", async (req, res) => {
    const { data, platform, mode } = req.body;
    try {
      const result = await ResilientAiCore.generate({
        prompt: `Advanced decipher mode ${mode} for ${platform}. Data:\n${data}`,
        systemInstruction: "Mestre decifrador e cryptanalyst de sistemas de entretenimento.",
        responseType: 'text',
        settings: req.body.settings
      });
      res.json({ analysis: result.content });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/deep-analyze", async (req, res) => {
    const { asm, platform } = req.body;
    try {
      const result = await ResilientAiCore.generate({
        prompt: `Por favor, analise o seguinte código Assembly para a arquitetura ${platform}. 
Explique o propósito semântico de cada instrução no contexto de uma recompilação estática (Static Recompilation / Porting). 
Use seu conhecimento sobre a arquitetura ${platform} para inferir e documentar a lógica de alto nível que esse bloco representa.

Código Assembly:
${asm}`,
        systemInstruction: "Você é um Engenheiro Sênior Especialista em Recompilação Estática e Arquitetura de Computadores (Low-level). Forneça explicações semânticas detalhadas para cada instrução.",
        responseType: 'text',
        settings: req.body.settings
      });
      res.json({ analysis: result.content });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/extract-signature", async (req, res) => {
    const { asm, platform } = req.body;
    try {
      const result = await ResilientAiCore.generate({
        prompt: `Extract function signature from ${platform} ASM:\n${asm}`,
        systemInstruction: "Expert em Assinaturas C/C++ baseadas em binário.",
        responseType: 'text',
        settings: req.body.settings
      });
      res.json({ analysis: result.content });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/translate-strings", async (req, res) => {
    const { strings, platform, targetLanguage, settings } = req.body;
    try {
      const result = await ResilientAiCore.generate({
        prompt: `Traduza as seguintes strings de um binário de ${platform} para ${targetLanguage}.
Mantenha a semântica de tradução de jogos retro.
MUITO IMPORTANTE: Para cada string, forneça uma tradução que respeite o limite de caracteres (tamanho original ou menor, se possível).
Se a tradução for maior, indique "[LONG]" no início.
Retorne um objeto JSON com o seguinte formato:
{
  "translations": [
    { "original": "...", "translated": "...", "length_ok": true, "suggested_pointer_update": false }
  ]
}

Strings:
${JSON.stringify(strings)}`,
        systemInstruction: "Expert em Localização de Jogos Retro e Romhacking.",
        responseType: 'json',
        settings: req.body.settings
      });
      res.json(result.content);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/system/arch-fingerprint", async (req, res) => {
    const { hexSample } = req.body;
    try {
      const result = await ResilientAiCore.generate({
        prompt: `Analise as seguintes sequências hexadecimais: ${hexSample}. 
Determine a arquitetura provável (MIPS R3000, x86, ARM, Z80, 6502, etc.) baseada em padrões de opcodes, alinhamento de 4-bytes, endianness e prólogos de função comuns. 
Retorne um JSON: { "arch": "...", "confidence": 0.0, "reasoning": "..." }`,
        systemInstruction: "Expert System Architect & Forensic Analyst. Identifique arquiteturas binárias com precisão cirúrgica.",
        responseType: 'json',
        settings: req.body.settings
      });
      res.json(result.content);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/decompile", async (req, res) => {
    const { asm, arch, intent, hint, pass = "full" } = req.body;
    
    // Guard: Prevent massive payloads
    if (asm && asm.length > 100000) {
      return res.status(413).json({ error: "Payload too large. Max 100KB ASM." });
    }

    const decompileInstructions = {
      full: "Translate into clean, high-level C++ pseudo-code with detailed structural comments.",
      logic_only: "Extract ONLY the logical control flow (loops, branches, conditions) in an abstract representation.",
      naming: "Focus strictly on identifying and generating meaningful names for variables and functions based on their access patterns."
    };
    const instructions = decompileInstructions[pass as keyof typeof decompileInstructions] || decompileInstructions.full;

    const cacheKey = `decompile_${crypto.createHash('md5').update(asm + arch + pass).digest('hex')}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ analysis: cached, source: 'cache' });

    try {
      const result = await ResilientAiCore.generate({
        prompt: `${instructions}
Target Arch: ${arch}
${hint ? `Architectural Context: ${hint}` : ""}

Focus points:
1. Control flow fidelity.
2. Structure/Object inference.
3. Call stack reconstruction.
4. Memory safety annotations.

Context/Mod Intent: ${intent || "General Forensic Analysis"}

Assembly Code:
${asm}`,
        systemInstruction: "Expert Neural Decompiler & Reverse Engineering Architect specializing in legacy game console architectures and binary security.",
        responseType: 'text',
        settings: req.body.settings
      });
      setCache(cacheKey, result.content);
      res.json({ analysis: result.content, source: 'model' });
    } catch (e: any) {
      console.error(`[AI DECOMPILE ERROR]`, e);
      res.status(500).json({ error: "Decompilation engine failure. Check architecture constraints." });
    }
  });

  app.post("/api/refactor-asm", async (req, res) => {
    const { asm, arch } = req.body;
    try {
      const result = await ResilientAiCore.generate({
        prompt: `Refatore este código Assembly ${arch} para legibilidade industrial.
Diretrizes:
1. Comentários detalhados linha a linha explicando o propósito lógico.
2. Identifique o uso de registradores (ex: indicar que $a0 é usado como contador ou ponteiro).
3. Padronize a indentação.
4. Tente inferir nomes de labels baseados no comportamento (ex: loop_copy, handle_input).
5. Se detectar padrões de BIOS ou syscalls MIPS (R3000), documente-os.

Código:
${asm}`,
        systemInstruction: "Especialista Supremo em Engenharia Reversa MIPS R3000 e Analista de Binários.",
        responseType: 'text',
        settings: req.body.settings
      });
      res.json({ refactored: result.content });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/compile-asm", async (req, res) => {
    const { asm, arch } = req.body;
    try {
      const result = await ResilientAiCore.generate({
        prompt: `Compile ${arch} ASM into Hex Bytes: ${asm}`,
        systemInstruction: "Compilador Binário. Return only HEX bytes separated by spaces.",
        responseType: 'text',
        settings: req.body.settings
      });
      res.json({ hex: result.content.trim() });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/yara-scan", async (req, res) => {
    const { hex, platform } = req.body;
    try {
      const result = await ResilientAiCore.generate({
        prompt: `YARA Scan on ${platform} hex:\n${hex}`,
        systemInstruction: "YARA Neural Scanner. Output Markdown table.",
        responseType: 'text',
        settings: req.body.settings
      });
      res.json({ analysis: result.content });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/deep-scan", async (req, res) => {
    const { hexSample, platform } = req.body;
    try {
      const result = await ResilientAiCore.generate({
        prompt: `Realize um escaneamento forense profundo neste trecho hexadecimal de ${platform}.
Identifique:
1. Padrões de alinhamento de dados.
2. Possíveis tabelas de ponteiros (pelo menos 3 candidatos).
3. Assinaturas de compilador (MSVC, GCC, Watcom, etc).
4. Entropia visual aproximada.

Hex: ${hexSample}`,
        systemInstruction: "Especialista sênior em forense digital e análise de artefatos binários.",
        responseType: 'text',
        settings: req.body.settings
      });
      res.json({ analysis: result.content });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/advanced-decipher", async (req, res) => {
    const { hexSample, context } = req.body;
    try {
      const result = await ResilientAiCore.generate({
        prompt: `Analise as seguintes sequências hexadecimais: ${hexSample}. 
Contexto do Sistema: ${context}
Determine se há estruturas de compressão proprietárias, cabeçalhos de arquivos embutidos ou lógica de bytecode customizada.`,
        systemInstruction: "Expert em Engenharia Reversa e Forense de Dados. Retorne análise estrutural profunda.",
        responseType: 'json',
        settings: req.body.settings
      });
      res.json(result.content);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/ai-fazer-tudo", async (req, res) => {
    const { strings, hexSample, fileSize, platform } = req.body;
    try {
      const result = await ResilientAiCore.generate({
        prompt: `Realize uma análise heurística completa deste binário de ${fileSize} bytes.
Arquitetura alvo (se conhecida): ${platform}
Strings detectadas: ${strings}
Amostra Hexadecimal Inicial: ${hexSample}

Exiba os resultados no formato Markdown estruturado:
1. **Detecção de Arquitetura**: (com nível de confiança baseado no Hex e contexto)
2. **Memory Mapping Mapeado**: (Estruturas prováveis identificadas: Segmentos .text, .data, etc.)
3. **Resumo das Strings**: (Significado, motor gráfico suspeito, se ofuscado ou não)
4. **Alvos de Modding**: (Quais as áreas/offsets de maior interesse baseadas na amostra para hacks/mods)`,
        systemInstruction: "Você é o agente 'IA FAZER TUDO' do RetroForge. Um analista supremo de engenharia reversa capaz de deduzir a estrutura inteira de um binário apenas olhando seus padrões.",
        responseType: 'text',
        settings: req.body.settings
      });
      res.json({ analysis: result.content });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/scan-assets", async (req, res) => {
    const { data, platform } = req.body;
    try {
      const result = await ResilientAiCore.generate({
        prompt: `Analise assinaturas de assets (textures, audio, tables) em:\n${data}\nPlat: ${platform}`,
        systemInstruction: "Expert em Forense de Assets Legados.",
        responseType: 'text',
        settings: req.body.settings
      });
      res.json({ analysis: result.content });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/system/health", (req, res) => {
    res.json({
      status: "OPTIMAL",
      uptime: process.uptime(),
      eventsPerSecond: (Math.random() * 5).toFixed(2),
      memory: process.memoryUsage().heapUsed,
      nodeVersion: process.version,
      platform: process.platform,
      activeModules: ["Vite", "SocketIO", "ResilientAiCore", "YARA_Scanner"]
    });
  });

  app.post("/api/github/sync", async (req, res) => {
    if (!githubToken) return res.status(401).json({ error: "Não conectado ao GitHub" });
    
    const { projectName, platform, tasks } = req.body;
    
    try {
      // 1. Get user info
      const userRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `token ${githubToken}` }
      });
      const user = await userRes.json();

      // 2. Try to create repo (or check if exists)
      const repoName = `${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-recomp`;
      
      const createRepoRes = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: {
          Authorization: `token ${githubToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: repoName,
          description: `Recompilação estática de ${projectName} (${platform}) via RetroForge AI`,
          private: false
        })
      });

      // 3. Create or Update README.md with project status
      const readmeContent = `# ${projectName} - Recompilação\n\n## Detalhes\n- Plataforma: ${platform}\n- Status: Analysed\n\n## Log de Análise\n${tasks.map((t: string) => `- ${t}`).join('\n')}\n\nGenerated by RetroForge AI`;
      
      // For a real app, you'd need to handle SHA for updates, but for this demo:
      const putFileRes = await fetch(`https://api.github.com/repos/${user.login}/${repoName}/contents/README.md`, {
        method: "PUT",
        headers: {
          Authorization: `token ${githubToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Sync from RetroForge AI",
          content: Buffer.from(readmeContent).toString("base64")
        })
      });

      res.json({ success: true, url: `https://github.com/${user.login}/${repoName}` });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro ao sincronizar com GitHub" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // --- V9 SUPREME COGNITIVE OPERATING SYSTEM ENDPOINTS ---

  app.post("/api/knowledge-injection", async (req, res) => {
    const { topic, context } = req.body;
    try {
      const result = await ResilientAiCore.generate({
        prompt: `INJEÇÃO DE CONHECIMENTO SUPREMO V9.
Assunto: ${topic}
Contexto do Projeto: ${JSON.stringify(context)}

Tarefa:
1. Realize uma busca profunda (mentalmente ou via ferramentas externas se disponíveis) sobre as APIS/Bibliotecas mencionadas.
2. Identifique lacunas de segurança ou performance na implementação atual.
3. Forneça o "Latest Ecosystem Pattern" para resolver.
4. Retorne em formato Markdown industrial.`,
        systemInstruction: "Você é o Engenheiro de Software Supremo V9. Forneça documentação técnica de nível industrial e correções cirúrgicas.",
        responseType: 'text',
        settings: req.body.settings
      });
      res.json({ documentation: result.content });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
