# RETROFORGE AI: Supreme Engineering Architecture Wiki

<div align="center">
  <h2><strong>A Pinnacle in Distributed Systems & AI Reverse Engineering</strong></h2>
</div>

RetroForge AI is far beyond a simple web app. It is a **Highly Available, Resilient, AI-Orchestrated System** that leverages advanced infrastructure principles to deliver uninterrupted parsing, recompilation, and binary modification at an industrial scale. 

This README serves as the **Supreme Wiki & Blueprint** for understanding every byte of its architecture, optimization routines, and deployment cycles.

---

## 🏛️ 1. Theoretical Architecture (V9 Nexus)

The platform is engineered around the **Omni-Engineer v2.0-ULTIMATE Protocol**. In simple terms, it is:
1. **Event-Driven**: Complete decoupling of layers via `eventBus.ts`.
2. **Stateless (at the edge)**: `InfrastructureDaemon` serves HTTP layers immutably.
3. **Resilient**: Implements auto-healing, exponential backoff, and timeouts for LLMs and Redis.

### Architectural Tiers Breakdown
- **Tier 0 (Hardware / Memory)**: Redis Pub/Sub, Node.js V8 GC-Optimized buffers, and LocalStorage/IndexedDB.
- **Tier 1 (Core Matrix)**: Functional manipulators within `/src/core`. They only do one thing, pure functions, zero side effects.
- **Tier 2 (AI Intelligence Hub)**: The `ResilientAiCore`. A supreme multi-agent routing algorithm. It balances load across Gemini, Ollama, and Nvidia NIM with integrated Circuit Breakers and Fallbacks.
- **Tier 3 (Guardian Layer)**: Telemetry loggers (`loggerService`) and Active Monitors (`monitorService`) observing CPU thresholds, latency, and cache misses.
- **Tier 4 (React/Vite Engine)**: A meticulously handcrafted Tailwind UI consuming standard WebSockets for reactive, jitter-free rendering.

---

## ⚡ 2. Extreme Optimization Engineering

We have extracted every millisecond of performance out of the Node.js V8 engine and the network stack.

### Backend Optimizations
- **Compression Level 9**: All outgoing HTTP responses are compressed at the maximum possible algorithm depth (`compression({ level: 9 })`).
- **Zero-Copy Static Delivery**: Vite builds the frontend to static immutable chunks, and Express delivers them with 1-year max-age caching policies (`maxAge: '1y', immutable: true`).
- **HTTP/Keep-Alive Maximation**: Node.js `keepAliveTimeout` explicitly set to 65s to prevent cloud-proxy racing (AWS/GCP optimal defaults), preventing costly TCP handshakes on every request.
- **Garbage Collection Deferral**: Subsystems like `CacheEngine` implement active LRU manual sweeps periodically `setInterval(...).unref()`, allowing the master Thread to ignore it until necessary.

### Frontend Optimizations
- **Debounced Reactivity**: High-frequency metrics (health data) are pooled and drawn using selective render arrays.
- **Motion UI Virtualization**: Tailwind + Motion handle GPU-accelerated transforms without triggering reflows.

---

## 🛡️ 3. Security & Stability (Guardian Subsystems)

Security is not an afterthought; it is embedded into the core daemon.

- **Helmet Header Injector**: Protects against clickjacking, XSS, and MIME sniffing automatically.
- **Dynamic Rate Limiter**: A heavy-duty memory buffer dropping IPs that exceed 500 requests/minute to prevent DDoS or API quota drains.
- **Payload Strictness**: Symmetrical `express.json({ limit: "50mb" })` protects the memory heap while allowing large binary streams.
- **Graceful Takedown**: Advanced `SIGINT/SIGTERM` listening ensures all Redis sockets and WebSocket queues flush to disk safely before Node exits.

---

## 🤖 4. The Multi-Model AI Router (ResilientAiCore)

The core is programmed to NEVER fail.
- **Primary Attack Vector**: `Gemini 2.5 Flash` (Fastest, integrated native context).
- **Secondary (Performance/Math) Vector**: `Nvidia NIM Llama 3.1 405b`.
- **Tertiary (Offline) Vector**: Local `Ollama Qwen2.5-Coder` instance.

> **The Try-Catch-Race Pattern**: Every request uses `Promise.race[]` with an `AbortController`. If Gemini stalls for 25 seconds, the sequence kills the TCP connection instantly to prevent ghost-connections and retries with an Exponential Backoff strategy (`500ms * 2^attempt`).

---

## 🚀 5. Supreme Pipeline & Lifecycle Manager

RetroForge includes heavily optimized `npm run` lifecycles ensuring clean deployment matrices.

### The Scripts
- `npm run dev`: Boots the entire TypeScript Node + Vite middleware via `tsx`. Instant HMR routing where available.
- `npm run build`: Flushes previous distributions (`clean`), bundles the frontend SPA, and uses `esbuild` to compile a single server binary (`server.cjs`) dropping the `.vite` cache.
- `npm run clean:all`: The scorched-earth cleanup routine. Destroys all dependencies and locks to prepare for a pristine reinstall.
- `npm run update:sys`: Bumps all `package.json` payloads safely.

### Full Installation Flow (From Zero to Production)
```bash
# 1. Extreme Clean Slate Installation
git clone <repo> retroforge
cd retroforge
npm run clean:all
npm install

# 2. Configure Environment (Copy .env.example)
cp .env.example .env
# Edit .env with your GEMINI_API_KEY, REDIS_URL, etc.

# 3. Compile the Production Payload
npm run build

# 4. Initiate the Supreme Daemon
npm run start
```

---

## ⚙️ 6. System Configuration Keys (The .env Standard)

To unlock the maximum potential, ensure these are configured:
* `GEMINI_API_KEY`: Primary Brain (Required).
* `REDIS_URL`: Enables Multi-Node clustering across the world.
* `NVIDIA_API_KEY`: Fallback super-compute cluster.
* `OLLAMA_HOST`: For extreme air-gapped environments.

---

## 🏗️ 7. Development Guidelines & Contributing

- **The Golden Rule**: NEVER REMOVE A FEATURE. RetroForge only expanses. Optimize existing logic, refactor structurally, but retain all functional user paths.
- **Component Standard**: Strict Tailwind spacing (M3 design system). Use `.m3-button-filled`, `.m3-input`.
- **Logs**: Do not use raw `console.log` for business paths. Use `logger.log(LogLevel.INFO, 'Ctx', 'msg')` so telemetry can pick it up.

> *Architected by the Industrial Code Compiler AI. Immutable perfection.*
