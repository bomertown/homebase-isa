import { defineConfig } from 'drizzle-kit';

// CTO answer A3: migrations run against the unpooled connection.
// `generate` doesn't need a live DB; `migrate` and `studio` do.
function ensureSslMode(raw: string): string {
  if (!raw) return raw;
  if (/[?&]sslmode=/.test(raw)) return raw;
  return raw + (raw.includes('?') ? '&' : '?') + 'sslmode=require';
}

const migrationUrl = ensureSslMode(
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '',
);

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: migrationUrl },
  strict: true,
  verbose: true,
});
