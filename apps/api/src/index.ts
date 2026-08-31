import { serve } from '@hono/node-server';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { auth } from './auth.js';
import { env } from './env.js';
import { createContext } from './trpc/context.js';
import { appRouter } from './trpc/router.js';

const app = new Hono();

app.use(
  '*',
  cors({
    origin: env.WEB_ORIGIN,
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.get('/health', (c) => c.json({ ok: true }));

// Better Auth handles all sign-in / session routes.
app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));

// tRPC API.
app.all('/api/trpc/*', (c) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req: c.req.raw,
    router: appRouter,
    createContext,
  }),
);

serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  console.log(`🚀 API listening on http://localhost:${info.port}`);
});
