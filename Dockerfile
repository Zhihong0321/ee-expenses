# EE-Expenses Railway Build (Dockerfile - No Nixpacks)
# Multi-stage build: Frontend build -> Backend runtime

# ===================== STAGE 1: Build Frontend =====================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source and build
COPY frontend/ ./
RUN npm run build

# ===================== STAGE 2: Backend Runtime =====================
FROM node:20-alpine AS runtime

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy backend package files
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy backend source code
COPY backend/src/ ./src/
COPY backend/schema.sql ./

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/frontend/dist ./public

# Create uploads directory
RUN mkdir -p uploads

# Environment variables (Railway will override these)
ENV NODE_ENV=production
ENV PORT=10002
ENV FRONTEND_URL=""

# Expose port
EXPOSE 10002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:10002/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Start with dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
