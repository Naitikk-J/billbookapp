import type { IncomingMessage, ServerResponse } from 'http';
import { bootstrap } from '../src/app';

let appPromise: ReturnType<typeof bootstrap> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!appPromise) appPromise = bootstrap();
  const app = await appPromise;
  return app(req as never, res as never);
}
