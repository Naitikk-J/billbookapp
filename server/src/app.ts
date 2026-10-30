import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';

import { env, isProd } from './config/env';
import { connectDB } from './config/db';
import { ApiError } from './utils/ApiError';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth';
import companyRoutes from './routes/company';
import customerRoutes from './routes/customers';
import productRoutes from './routes/products';
import invoiceRoutes from './routes/invoices';
import ledgerRoutes from './routes/ledger';
import aiRoutes from './routes/ai';
import flightRoutes from './routes/flights';
import flightInvoiceRoutes from './routes/flightInvoices';
import whatsappRoutes from './routes/whatsapp';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (env.corsOrigin.includes('*') || env.corsOrigin.includes(origin)) return cb(null, true);
        cb(new Error(`CORS blocked: ${origin}`));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '12mb' }));
  app.use(express.urlencoded({ extended: true, limit: '12mb' }));
  app.use(mongoSanitize());
  if (!isProd) app.use(morgan('dev'));

  const limiter = rateLimit({
    windowMs: 60_000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);

  app.get('/api/health', async (_req: Request, res: Response) => {
    let db: 'connected' | 'disconnected' | 'error' = 'disconnected';
    try {
      await connectDB();
      db = 'connected';
    } catch {
      db = 'error';
    }
    res.json({ ok: db === 'connected', env: env.nodeEnv, db, time: new Date().toISOString() });
  });

  app.use(async (_req: Request, _res: Response, next) => {
    try {
      await connectDB();
      next();
    } catch (err) {
      console.error('[db] connect failed', err);
      next(new ApiError(503, 'Database connection failed'));
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/company', companyRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/ledger', ledgerRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/flights', flightRoutes);
  app.use('/api/flight-invoices', flightInvoiceRoutes);
  app.use('/api/whatsapp', whatsappRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export async function bootstrap(): Promise<Express> {
  return createApp();
}
