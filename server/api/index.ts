import type { IncomingMessage, ServerResponse } from 'http';
import { bootstrap } from '../src/app';

let appPromise: ReturnType<typeof bootstrap> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (!appPromise) appPromise = bootstrap();
    const app = await appPromise;
    return app(req as never, res as never);
  } catch (err) {
    console.error('[api] handler bootstrap failed', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: {
            message: err instanceof Error ? err.message : 'Server failed to start',
          },
        })
      );
    }
  }
}
