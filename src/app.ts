import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import healthRouter from './routes/health.js';
import callsRouter from './routes/calls.js';
import { errorMiddleware } from './lib/errors.js';

export function createApp() {
  const app = express();

  // ── Trust Render's proxy (for correct IP in rate-limiting) ─────────────────
  app.set('trust proxy', 1);

  // ── Security headers ────────────────────────────────────────────────────────
  app.use(helmet());

  // ── CORS allow-list ─────────────────────────────────────────────────────────
  const allowedOrigins = [config.FRONTEND_ORIGIN];
  // Always allow local Vite dev server during development
  if (config.NODE_ENV !== 'production') {
    allowedOrigins.push('http://localhost:5173');
  }

  app.use(
    cors({
      origin: (origin, cb) => {
        // allow server-to-server / curl requests (no origin header)
        if (!origin || allowedOrigins.includes(origin)) {
          cb(null, true);
        } else {
          cb(new Error(`CORS: origin ${origin} not allowed.`));
        }
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
    })
  );

  // ── Request size limit (100 kB, TRD Section 9) ──────────────────────────────
  app.use(express.json({ limit: '100kb' }));

  // ── General rate limit: 100 req/min/IP ────────────────────────────────────
  app.use(
    rateLimit({
      windowMs: 60_000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Slow down.' },
      },
    })
  );

  // ── Routes ──────────────────────────────────────────────────────────────────
  app.use('/api/health', healthRouter);
  app.use('/api/calls', callsRouter);

  // ── 404 fallthrough ─────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
  });

  // ── Error middleware (must be last) ─────────────────────────────────────────
  app.use(errorMiddleware);

  return app;
}
