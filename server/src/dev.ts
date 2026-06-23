import { bootstrap } from './app';
import { env } from './config/env';

async function main() {
  const app = await bootstrap();
  app.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`);
    console.log(`CORS origin: ${env.corsOrigin.join(', ')}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
