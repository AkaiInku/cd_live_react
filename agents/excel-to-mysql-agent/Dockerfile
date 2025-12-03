# ExcelToMySQLAgent Dockerfile
# Multi-stage build for optimized production image

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S agent -u 1001 -G nodejs

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY --from=builder /app/server.js ./

# Set ownership
RUN chown -R agent:nodejs /app

# Switch to non-root user
USER agent

# Environment variables (these should be overridden at runtime)
ENV NODE_ENV=production
ENV PORT=8080
ENV BATCH_SIZE=500

# Expose the configured port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Use dumb-init for proper PID 1 behavior
ENTRYPOINT ["dumb-init", "--"]

# Start the server
CMD ["node", "server.js"]
