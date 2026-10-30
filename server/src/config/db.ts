import mongoose from 'mongoose';
import { env } from './env';
import { ensureDbIndexes } from './ensureIndexes';

type ConnState = { promise: Promise<typeof mongoose> | null; conn: typeof mongoose | null };

const globalForMongoose = global as unknown as { __mongoose?: ConnState };
const cached: ConnState = globalForMongoose.__mongoose ?? { promise: null, conn: null };
globalForMongoose.__mongoose = cached;

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    mongoose.set('strictQuery', true);
    cached.promise = mongoose.connect(env.mongoUri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 10_000,
      maxIdleTimeMS: 30_000,
    });
  }
  cached.conn = await cached.promise;
  await ensureDbIndexes();
  return cached.conn;
}
