import { serve } from '@hono/node-server';
import pino from 'pino';
import { loadConfig } from './config.ts';
import { loadEnvFiles } from './env.ts';
import { createApp } from './http/app.ts';
import { createServices } from './services.ts';

loadEnvFiles();
const cfg = loadConfig();
const log = pino({ level: cfg.logLevel });

const services = await createServices(cfg, log);
const app = createApp(services);
const stats = services.drugDb.stats();
const server = serve({ fetch: app.fetch, port: cfg.port }, (info) => {
  log.info({ port: info.port, drugs: stats.drugs, interactions: stats.interactions, agentModel: cfg.agentModel }, 'DDI server listening');
});

const shutdown = () => {
  log.info('shutting down');
  server.close(() => {
    services.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
