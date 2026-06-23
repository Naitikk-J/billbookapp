import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';

import { env, isProd } from './config/env';
import { connectDB } from './config/db';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth';
import companyRoutes from './routes/company';
import customerRoutes from './routes/customers';
import productRoutes from './routes/products';
import invoiceRoutes from './routes/invoices';

let initialized = false;

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
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(mongoSanitize());
  if (!isProd) app.use(morgan('dev'));

  const limiter = rateLimit({
    windowMs: 60_000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, env: env.nodeEnv, time: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/company', companyRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/invoices', invoiceRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export async function bootstrap(): Promise<Express> {
  if (!initialized) {
    await connectDB();
    initialized = true;
  }
  return createApp();
}
