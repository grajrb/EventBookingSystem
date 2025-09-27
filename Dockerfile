# Multi-stage build for EventBookingSystem
# Stage 1: Build client + server bundle
FROM node:20-alpine AS build
WORKDIR /app

# Install deps (copy manifests first for caching)
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Build client and server: client uses vite; server bundles via existing build script
RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy only needed files
COPY package*.json ./
# Install production deps only
RUN npm install --omit=dev

# Copy server bundle and client build output
COPY --from=build /app/dist ./dist
COPY --from=build /app/client/dist ./client/dist

# Expose app port (matches PORT default 5000)
EXPOSE 5000

# Healthcheck (optional, Fly also supports checks via fly.toml)
# HEALTHCHECK CMD wget -qO- http://localhost:5000/healthz || exit 1

CMD ["node", "dist/index.js"]
