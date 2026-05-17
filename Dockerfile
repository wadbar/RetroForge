# OMNI-ENGINEER: Multi-stage Dockerfile for RetroForge Ecosystem

# Stage 1: Dependency Resolution
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Build Environment
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Compile Vite client, ESBuild server, and standalone SDK
RUN npm run build
RUN npm run build:sdk

# Stage 3: Production Runtime
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Security: Create unprivileged user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S retroforge -u 1001

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Only copy production dependencies to keep the image small
# Note: Since the server is bundled using esbuild (dist/server.cjs is self-contained without externals or dependencies needed except sharp if we had it), we technically don't need all node_modules. 
# But for safety we will copy production dependencies if `npm ci --omit=dev` was run, or we can just rely on the full node_modules.
# Actually in server.ts we bundle with --packages=external so we need node_modules.
COPY --from=builder /app/node_modules ./node_modules

USER retroforge

EXPOSE 3000

# Healthcheck to interface with Docker Swarm / K8s
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["npm", "start"]
