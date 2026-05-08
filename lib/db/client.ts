import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Per CTO answer A3: app queries use the pooled DATABASE_URL.
// Migrations use DATABASE_URL_UNPOOLED via drizzle.config.ts.
//
// Lazy init so importing this module doesn't crash builds when env vars
// aren't available at bundle time (e.g. early Vercel preview builds).
type DrizzleClient = ReturnType<typeof drizzle<typeof schema>>;

let cached: DrizzleClient | null = null;

function getClient(): DrizzleClient {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  cached = drizzle(neon(url), { schema });
  return cached;
}

export const db = new Proxy({} as DrizzleClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});
