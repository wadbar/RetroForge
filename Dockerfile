# OMNI-ENGINEER: Multi-stage Dockerfile for RetroForge Ecosystem

# Stage 1: Dependency Resolution (All)
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
# Clean dev dependencies for production reduction
RUN npm ci --omit=dev && npm cache clean --force

# Stage 3: Production Runtime
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Security: Create unprivileged user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S retroforge -u 1001

COPY --from=builder --chown=retroforge:nodejs /app/dist ./dist
COPY --from=builder --chown=retroforge:nodejs /app/package.json ./package.json

# Only copy production dependencies to keep the image microscopic
COPY --from=builder --chown=retroforge:nodejs /app/node_modules ./node_modules

USER retroforge

EXPOSE 3000

# Strict Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/system/health || exit 1

CMD ["npm", "start"]
