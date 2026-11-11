# ── High-Speed Production Image ────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy server package files
COPY server/package.json server/package-lock.json* ./server/

# Install only lightweight production server dependencies (super fast)
RUN npm install --prefix server --omit=dev --no-audit --no-fund

# Copy server source
COPY server/ ./server/

# Copy pre-built client distribution files directly
COPY client/dist/ ./client/dist/

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["node", "server/server.js"]
