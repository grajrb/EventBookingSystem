// Load environment variables first
import 'dotenv/config';

import express, { type Request, Response, NextFunction } from "express";
import helmet from 'helmet';
import compression from 'compression';
import { baseLimiter } from './middleware/rateLimit';
import { registerRoutes } from "./routes";
import { serveStatic, setupVite, log } from "./vite";
import { setupWebSocketServer } from "./websocket";
import fs from 'fs';
import path from 'path';
import { errorHandler, notFound } from "./middleware/errorHandler";

const app = express();
// Trust proxy for correct IPs & protocol when behind reverse proxy (adjust if not needed)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Compression for responses
app.use(compression());

// Body parsers with explicit limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Global basic rate limiter (more specific ones mounted in routes.ts)
app.use('/api', baseLimiter);

// Avoid noisy 404 logs for favicon
app.get('/favicon.ico', (_req, res) => res.status(204).end());

// CORS middleware (configurable via ALLOWED_ORIGINS env as comma-separated list; defaults to *)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;
  if (allowedOrigins.includes('*')) {
    res.header('Access-Control-Allow-Origin', '*');
  } else if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Register API routes first
    const server = await registerRoutes(app);

    // Setup WebSocket server
  const wss = setupWebSocketServer(server);

    const isProd = process.env.NODE_ENV === 'production';

    if (isProd) {
      // In production we expect the client to be pre-built
      serveStatic(app);

      // Health / readiness endpoints (fast, no DB query to avoid cascading failures)
      app.get('/healthz', (_req, res) => res.status(200).json({ status: 'ok' }));
      app.get('/readyz', (_req, res) => {
        // Later could add lightweight db/redis ping
        return res.status(200).json({ status: 'ready' });
      });

      // Explicit SPA fallback AFTER static & API routes, BEFORE notFound
      const distIndex = path.join(process.cwd(), 'client', 'dist', 'index.html');
      app.get('*', (req, res, next) => {
        if (req.method !== 'GET') return next();
        if (req.path.startsWith('/api')) return next();
        if (req.path.startsWith('/healthz') || req.path.startsWith('/readyz')) return next();
        if (!fs.existsSync(distIndex)) return next();
        res.setHeader('Cache-Control', 'no-cache');
        return res.sendFile(distIndex);
      });
    } else {
      // In development use Vite middleware for HMR and on-the-fly transforms
      await setupVite(app, server);

      // SPA fallback: for any non-API, non-static request, let Vite serve index.html
      app.use((req, res, next) => {
        if (req.method !== 'GET') return next();
        if (req.path.startsWith('/api')) return next();
        // Vite middleware already attached; just fall through to its * handler
        return next();
      });
    }

  // Add error handling middleware at the end (after all routes and static files / SPA fallback)
    app.use(notFound);
    app.use(errorHandler);

    // Error handler for middleware errors
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
    });

    // ALWAYS serve the app on port 5000
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = Number(process.env.PORT) || 5000;
    server.listen(port, "0.0.0.0", () => {
      log(`serving on port ${port} (env PORT=${process.env.PORT || 'unset'})`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
