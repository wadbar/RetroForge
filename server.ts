import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import crypto from "crypto";
import http from "http";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Server as SocketIOServer, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { ResilientAiCore } from "./src/services/ai/resilientAiCore";
import { logger, LogLevel } from "./src/core/utils/TelemetryLogger";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Persistent Memory Cache ---
class CacheEngine {
  private static readonly cache = new Map<string, { content: any; expiry: number }>();
  private static readonly TTL_MS = 1000 * 60 * 60; // 1 hour

  public static get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.content;
  }

  public static set(key: string, content: any): void {
    this.cache.set(key, { content, expiry: Date.now() + this.TTL_MS });
  }

  public static sweep(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

// Memory Sweep Daemon
setInterval(() => CacheEngine.sweep(), 15 * 60 * 1000).unref();

// Generic Error Wrapper for Express
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      logger.log(LogLevel.ERROR, "AsyncHandler", `Route Error at ${req.path}`, { error: err.message, stack: err.stack });
      res.status(500).json({ error: "Internal Server Error", message: err.message });
    });
  };
};

class InfrastructureDaemon {
  private readonly app = express();
  private readonly server = http.createServer(this.app);
  private io!: SocketIOServer;
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private githubToken: string | null = null;
  
  constructor() {
    this.bindMiddlewares();
    this.bindRoutes();
  }

  public async bootstrap(port: number = 3000): Promise<void> {
    logger.log(LogLevel.INFO, "InfrastructureDaemon", "Initializing system boot sequences...");

    await this.setupWebSockets();
    await this.setupViteMiddleware();

    return new Promise((resolve) => {
      this.server.listen(port, "0.0.0.0", () => {
        logger.log(LogLevel.INFO, "InfrastructureDaemon", `V9 Server successfully deployed on http://localhost:${port}`);
        resolve();
      });
      this.bindGracefulShutdown();
    });
  }

  private async setupWebSockets(): Promise<void> {
    this.io = new SocketIOServer(this.server, { cors: { origin: "*" } });

    if (process.env.REDIS_URL) {
      try {
        this.pubClient = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 3 });
        this.subClient = this.pubClient.duplicate();
        
        this.pubClient.on('error', (err) => logger.log(LogLevel.ERROR, "Redis", "PubClient Error", { error: err.message }));
        this.subClient.on('error', (err) => logger.log(LogLevel.ERROR, "Redis", "SubClient Error", { error: err.message }));

        this.io.adapter(createAdapter(this.pubClient, this.subClient));
        logger.log(LogLevel.INFO, "InfrastructureDaemon", "Redis Adapter mounted for synchronous collaborative propagation.");
      } catch (err: any) {
        logger.log(LogLevel.WARN, "InfrastructureDaemon", "Redis binding failed, falling back to standalone memory adapter.", { error: err.message });
      }
    } else {
      logger.log(LogLevel.INFO, "InfrastructureDaemon", "No REDIS_URL provided. Executing WebSockets in standalone mode.");
    }

    this.startRomWatcher();

    this.io.on("connection", (socket: Socket) => {
      logger.log(LogLevel.DEBUG, "WebSocket", `Collaborative node attached: ${socket.id}`);

      socket.on("syncTuning", (data) => {
        socket.broadcast.emit("tuningUpdated", data);
      });

      socket.on("codeEdit", (data) => {
        socket.broadcast.emit("codeEditSync", data);
      });

      socket.on("disconnect", () => {
        logger.log(LogLevel.DEBUG, "WebSocket", `Collaborative node detached: ${socket.id}`);
        socket.removeAllListeners();
      });
    });
  }

  private startRomWatcher() {
    try {
      const fs = require('fs');
      const romsDir = path.join(process.cwd(), 'roms');
      if (!fs.existsSync(romsDir)) {
        fs.mkdirSync(romsDir, { recursive: true });
      }
      
      fs.watch(romsDir, (eventType: string, filename: string) => {
        if (filename && filename.match(/\.(rom|sfc|bin|iso|cue)$/i)) {
           logger.log(LogLevel.INFO, "InfrastructureDaemon", `ROM file mutation detected: ${filename} (${eventType})`);
           this.io.emit("ROM_FILE_MUTATION", { filename, eventType, timestamp: Date.now() });
        }
      });
      logger.log(LogLevel.INFO, "InfrastructureDaemon", "Native fs.watch activated for ROM directory.");
    } catch (e: any) {
      logger.log(LogLevel.WARN, "InfrastructureDaemon", "Could not initialize fs.watch for roms directory", { error: e.message });
    }
  }

  private async setupViteMiddleware(): Promise<void> {
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      this.app.use(vite.middlewares);
      logger.log(LogLevel.INFO, "InfrastructureDaemon", "Vite Development Middleware hooked.");
    } else {
      const distPath = path.join(process.cwd(), "dist");
      // Extreme optimization for static downloads: Max caching & Immutable chunks
      this.app.use(express.static(distPath, {
        maxAge: '1y',
        immutable: true,
        etag: true,
        lastModified: true,
      }));
      this.app.get("*", (req: Request, res: Response) => {
        // Provide standard SPA fallback but do not aggressively cache the entry index.html
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(path.join(distPath, "index.html"));
      });
      logger.log(LogLevel.INFO, "InfrastructureDaemon", "Production Static File Routing & Content Delivery Optimization enabled.");
    }
  }

  private bindMiddlewares(): void {
    // Supreme optimizations
    // Trust proxy for reverse proxies (like Cloud Run / NGINX)
    this.app.set("trust proxy", true);

    this.app.use(helmet({ contentSecurityPolicy: false })); // Basic security headers, disabling CSP for Dev HMR compat
    this.app.use(compression({ level: 9 })); // Max compression level for extreme bandwidth optimization
    this.app.use(express.json({ limit: "50mb" })); // Increased payload limit
    this.app.use(express.urlencoded({ extended: true, limit: "50mb" }));

    // Global Rate Limiting - Advanced
    const limiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 500, // limit each IP to 500 requests per windowMs
      message: "Too many requests from this IP, please try again after a minute",
      standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
      legacyHeaders: false, // Disable the `X-RateLimit-*` headers
      keyGenerator: (req) => {
        const forwarded = req.headers['forwarded'];
        if (forwarded) {
          const match = forwarded.match(/for="?([^";,]+)"?/);
          if (match) return match[1];
        }
        const xForwardedFor = req.headers['x-forwarded-for'];
        if (xForwardedFor) {
           return (typeof xForwardedFor === 'string' ? xForwardedFor : xForwardedFor[0]).split(',')[0].trim();
        }
        return req.ip || req.socket.remoteAddress || "unknown";
      },
      validate: {
        xForwardedForHeader: false, // Disable the X-Forwarded-For warning if trust proxy handles it
        default: true
      }
    });
    this.app.use("/api/", limiter);

    // Optimize Server Keep-Alive Networking
    this.server.keepAliveTimeout = 65000;
    this.server.headersTimeout = 66000;

    // Telemetry middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        if (req.path.startsWith('/api')) {
          if (res.statusCode >= 400) {
            logger.log(LogLevel.WARN, "HTTP", `${req.method} ${req.path}`, { durationMs: duration, status: res.statusCode });
          } else {
            logger.log(LogLevel.DEBUG, "HTTP", `${req.method} ${req.path}`, { durationMs: duration, status: res.statusCode });
          }
        }
      });
      next();
    });
  }

  private bindRoutes(): void {
    this.app.get("/api/system/stats", asyncHandler(async (req, res) => {
      const os = await import('os');
      const totalMemStr = (os.totalmem() / (1024 ** 3)).toFixed(2) + ' GB';
      const usedMemStr = ((os.totalmem() - os.freemem()) / (1024 ** 3)).toFixed(2) + ' GB';
      const cpuLoadPercent = Math.min(100, (os.loadavg()[0] / os.cpus().length) * 100).toFixed(1);
      res.json({ totalMemoryStr: totalMemStr, usedMemoryStr: usedMemStr, cpuLoadPercent, load: os.loadavg() });
    }));

    this.app.get("/api/system/telemetry", (req, res) => {
      res.json({
        status: "hyper-active",
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid
      });
    });

    this.app.get("/api/system/health", (req, res) => {
      res.json({
        status: "OPTIMAL",
        uptime: process.uptime(),
        memory: process.memoryUsage().heapUsed,
        nodeVersion: process.version,
        platform: process.platform
      });
    });

    // GitHub OAuth Routes
    this.app.get("/api/auth/github/url", asyncHandler(async (req, res) => {
      const clientId = process.env.GITHUB_CLIENT_ID;
      if (!clientId) throw new Error("GITHUB_CLIENT_ID missing in environment");
      const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/github/callback`;
      const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo,user`;
      res.json({ url });
    }));

    this.app.get("/api/auth/github/callback", asyncHandler(async (req, res) => {
      const { code } = req.query;
      if (!code) return res.redirect("/");

      const response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      const data = await response.json();
      if (!data.access_token) throw new Error("GitHub token exchange rejected");
      
      this.githubToken = data.access_token;
      res.send(`
        <html><body><script>
          if (window.opener) { window.opener.postMessage({ type: 'GITHUB_AUTH_SUCCESS' }, '*'); window.close(); }
          else { window.location.href = '/'; }
        </script><p>O-Auth Synced. Window autonomous teardown in progress...</p></body></html>
      `);
    }));

    this.app.get("/api/auth/github/status", (req, res) => {
      res.json({ connected: !!this.githubToken });
    });

    this.bindAITasks();
  }

  private bindAITasks(): void {
    this.app.post("/api/analyze", asyncHandler(async (req, res) => {
      const { projectName, platform, settings } = req.body;
      const cacheKey = `analyze_${projectName}_${platform}`;
      const cached = CacheEngine.get(cacheKey);
      if (cached) return res.json(cached);

      const result = await ResilientAiCore.generate({
        prompt: `Analise projeto "${projectName}" para "${platform}". Gere 5 tasks técnicas JSON: { "tasks": [] }`,
        systemInstruction: "Software Architect Sênior especializado em engenharia reversa e refatoração estática.",
        responseType: 'json',
        settings
      });
      CacheEngine.set(cacheKey, result.content);
      res.json(result.content);
    }));

    this.app.post("/api/analyze-asm", asyncHandler(async (req, res) => {
      const result = await ResilientAiCore.generate({
        prompt: `Analise ASM (${req.body.platform}):\n${req.body.asm}`,
        systemInstruction: "Especialista Arquiteto V8 e ASM Compiler.",
        responseType: 'text',
        settings: req.body.settings
      });
      res.json({ analysis: result.content });
    }));

    this.app.post("/api/generate-patch", asyncHandler(async (req, res) => {
      const result = await ResilientAiCore.generate({
        prompt: `Patch no endereco ${req.body.targetAddress} para "${req.body.intent}". ASM Orig:\n${req.body.asm}\nPlat: ${req.body.platform}`,
        systemInstruction: "Return ONLY the final hexadecimal patch bytes separated by spaces. No markdown.",
        responseType: 'text',
        settings: req.body.settings
      });
      res.json({ patch: result.content });
    }));

    this.app.post("/api/analyze-callstack", asyncHandler(async (req, res) => {
      const result = await ResilientAiCore.generate({
        prompt: `Analise o Call Stack em ASM/C++ para ${req.body.platform}:\n${req.body.code}\nRetorne os fluxos no formato JSON { "nodes": [], "links": [] }.`,
        systemInstruction: "Software Recompilation Analyst. Output pure semantic CFG matrices in JSON.",
        responseType: 'json',
        settings: req.body.settings
      });
      res.json({ analysis: result.content });
    }));

    this.app.post("/api/translate-strings", asyncHandler(async (req, res) => {
      const { strings, platform, targetLanguage, settings } = req.body;
      const result = await ResilientAiCore.generate({
        prompt: `Traduza array JSON de strings de binario ${platform} p/ ${targetLanguage}. Mantenha limite de memoria (use abreviacoes). Prefix [LONG] se exceder. Retorne JSON: {"translations": [{"original":".","translated":".","length_ok":true}]}. Strings:\n${JSON.stringify(strings)}`,
        systemInstruction: "Especialista em ROM Hacking Translation com rígida alocação de ponteiros.",
        responseType: 'json',
        settings
      });
      res.json(result.content);
    }));

    this.app.post("/api/analyze-tbl", asyncHandler(async (req, res) => {
      const result = await ResilientAiCore.generate({
        prompt: `Analista Binario Retro.\nHEX: ${req.body.sampleHex}\nSTRINGS (ASCII): ${req.body.strings?.slice(0,20).join('|')}\nIdentifique o TBL Encoding (byte->char). Retorne estrito formato de dados JSON: {"table":{"41":"A"}}`,
        systemInstruction: "Advanced cryptography AI. Decode custom character boundaries. Output exact JSON.",
        responseType: 'json',
        settings: req.body.settings
      });
      res.json({ analysis: result.content });
    }));

    this.app.post("/api/system/arch-fingerprint", asyncHandler(async (req, res) => {
      const result = await ResilientAiCore.generate({
        prompt: `Determine a arquitetura com base no hexa: ${req.body.hexSample}. Retorne JSON: {"arch":"...","confidence":0.99,"reasoning":"..."}`,
        systemInstruction: "Forensic CPU Architecture Parser.",
        responseType: 'json',
        settings: req.body.settings
      });
      res.json(result.content);
    }));

    this.app.post("/api/decompile", asyncHandler(async (req, res) => {
      const { asm, arch, intent, hint, pass = "full", settings } = req.body;
      if (asm && asm.length > 200000) throw new Error("Payload Memory Lock triggered: File exceeds safe decompilation chunk limits (200KB)");

      const instructions = pass === "logic_only" ? "Extract ONLY logic flow." : pass === "naming" ? "Focus on object names and inferred typing." : "Translate to C++ pseudo-code";
      const cacheKey = `dec_${crypto.createHash('md5').update(asm+arch+pass).digest('hex')}`;
      
      const cached = CacheEngine.get(cacheKey);
      if (cached) return res.json({ analysis: cached, source: 'cache' });

      const result = await ResilientAiCore.generate({
        prompt: `${instructions}\nTarget Arch: ${arch}\nHint: ${hint}\nIntent: ${intent}\nASM:\n${asm}`,
        systemInstruction: "Sênior Neural C/C++ Recompiler and Backend Reverse Engineer.",
        responseType: 'text',
        settings
      });
      
      CacheEngine.set(cacheKey, result.content);
      res.json({ analysis: result.content, source: 'model' });
    }));

    this.app.post("/api/github/sync", asyncHandler(async (req, res) => {
      if (!this.githubToken) throw new Error("GitHub context missing. Authentication required.");
      const { projectName, platform, tasks } = req.body;

      const userRes = await fetch("https://api.github.com/user", { headers: { Authorization: `token ${this.githubToken}` } });
      const user = await userRes.json();

      const repoName = `${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-recomp-ai`;
      
      await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: { Authorization: `token ${this.githubToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: repoName, description: `Automated Recompilation Data: ${platform}`, private: false })
      });

      const rootStruct = Buffer.from(`# ${projectName} Reverse Engineering Repository\nManaged by Industrial AI Decompiler.`).toString('base64');
      await fetch(`https://api.github.com/repos/${user.login}/${repoName}/contents/README.md`, {
        method: "PUT",
        headers: { Authorization: `token ${this.githubToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Init Commit (AI)", content: rootStruct })
      });

      res.json({ success: true, url: `https://github.com/${user.login}/${repoName}` });
    }));

    // Universal Fallback for any other endpoints matching typical payloads
    this.app.post("/api/advanced-decipher", asyncHandler(async (req, res) => {
      const result = await ResilientAiCore.generate({
        prompt: `Analise assinaturas de compressão e offsets em: ${req.body.hexSample}\nContexto: ${req.body.context}`,
        systemInstruction: "Expert cryptanalyst AI. Return dense structural analysis JSON.",
        responseType: 'json',
        settings: req.body.settings
      });
      res.json(result.content);
    }));

    this.app.post("/api/deep-analyze", asyncHandler(async (req, res) => {
      const result = await ResilientAiCore.generate({
        prompt: `Deep semantic breakdown of ${req.body.platform} ASM block. Return semantic intents line by line.\n${req.body.asm}`,
        systemInstruction: "Senior Computer Architecture Engineer.",
        responseType: 'text',
        settings: req.body.settings
      });
      res.json({ analysis: result.content });
    }));
  }

  private bindGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.log(LogLevel.WARN, "InfrastructureDaemon", `Teardown initiated via ${signal}.`);
      
      this.io.close(() => {
        logger.log(LogLevel.INFO, "InfrastructureDaemon", "WebSocket topology dismantled.");
      });

      if (this.pubClient) await this.pubClient.quit();
      if (this.subClient) await this.subClient.quit();

      this.server.close(async () => {
        logger.log(LogLevel.INFO, "InfrastructureDaemon", "HTTP Listeners unmounted. Graceful exit.");
        await logger.shutdown();
        process.exit(0);
      });

      setTimeout(() => {
        console.error("Forcing shutdown after 10s deadline.");
        process.exit(1);
      }, 10000).unref();
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  }
}

// Bootstrap Entry
const daemon = new InfrastructureDaemon();
daemon.bootstrap(3000).catch((err) => {
  logger.log(LogLevel.CRITICAL, "Process", "Fatal Boot Exception", { error: err.message, stack: err.stack });
  process.exit(1);
});
