import postgres from 'postgres';

function ensureSslMode(raw) {
  if (!raw) return raw;
  if (/[?&]sslmode=/.test(raw)) return raw;
  return raw + (raw.includes('?') ? '&' : '?') + 'sslmode=require';
}

const url = ensureSslMode(
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '',
);
if (!url) {
  console.error('DATABASE_URL_UNPOOLED not set');
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

const tables = await sql`
  SELECT table_schema, table_name
  FROM information_schema.tables
  WHERE table_schema NOT IN ('pg_catalog','information_schema')
    AND table_type = 'BASE TABLE'
  ORDER BY table_schema, table_name
`;
console.log('Tables:');
for (const r of tables) console.log(`  ${r.table_schema}.${r.table_name}`);

const indexes = await sql`
  SELECT schemaname, tablename, indexname
  FROM pg_indexes
  WHERE schemaname = 'public'
  ORDER BY tablename, indexname
`;
console.log('\nIndexes on public schema:');
for (const r of indexes) console.log(`  ${r.tablename}.${r.indexname}`);

await sql.end();
