import mongoose from 'mongoose';
import { env } from './env';

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
      serverSelectionTimeoutMS: 10_000,
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
