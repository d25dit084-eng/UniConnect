# syntax=docker/dockerfile:1
# ----------------------------------------------------
# Stage 1: Build & Native Dependencies
# ----------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install build tools required for native C++ bindings (bcrypt, etc.)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev

# ----------------------------------------------------
# Stage 2: Minimal Production Runtime
# ----------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

# Install curl for container healthcheck
RUN apk add --no-cache curl

ENV NODE_ENV=production

# Copy pre-compiled production node_modules from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY . .

# Ensure non-root node user owns all application files
RUN chown -R node:node /usr/src/app

USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["node", "server.js"]
