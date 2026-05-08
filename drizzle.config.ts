import { defineConfig } from 'drizzle-kit';

// CTO answer A3: migrations run against the unpooled connection.
// `generate` doesn't need a live DB; `migrate` and `studio` do — drizzle-kit
// will surface a clear error there if the URL is missing.
export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.DATABASE_URL ??
      '',
  },
  strict: true,
  verbose: true,
});
