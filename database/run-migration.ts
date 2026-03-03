/**
 * Script to run SQL migrations against Supabase using direct Postgres connection.
 * Usage: npx tsx database/run-migration.ts database/migrations/create_admin_users.sql
 *
 * Uses POSTGRES_HOST, POSTGRES_PASSWORD, etc. from .env.local for direct DB connection.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const POSTGRES_HOST = process.env.POSTGRES_HOST;
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD;
const POSTGRES_USER = process.env.POSTGRES_USER || 'postgres';
const POSTGRES_DATABASE = process.env.POSTGRES_DATABASE || 'postgres';

if (!POSTGRES_HOST || !POSTGRES_PASSWORD) {
  console.error('Missing POSTGRES_HOST or POSTGRES_PASSWORD in .env.local');
  process.exit(1);
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: npx tsx database/run-migration.ts <path-to-sql-file>');
  process.exit(1);
}

const sqlPath = resolve(migrationFile);
const sql = readFileSync(sqlPath, 'utf-8');

console.log(`Running migration: ${sqlPath}`);

function buildSslConfig(): { rejectUnauthorized: boolean; ca?: string } {
  const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';
  const config: { rejectUnauthorized: boolean; ca?: string } = { rejectUnauthorized };

  const ca = process.env.DB_SSL_CA;
  const caPath = process.env.DB_SSL_CA_PATH;
  if (ca) {
    config.ca = ca;
  } else if (caPath) {
    config.ca = readFileSync(resolve(caPath), 'utf-8');
  }

  return config;
}

async function runMigration() {
  const { default: pg } = await import('pg');
  const client = new pg.Client({
    host: POSTGRES_HOST,
    port: 5432,
    user: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    database: POSTGRES_DATABASE,
    ssl: buildSslConfig(),
  });

  let transactionStarted = false;
  try {
    await client.connect();
    console.log('Connected to database');

    await client.query('BEGIN');
    transactionStarted = true;

    await client.query(sql);

    await client.query('COMMIT');
    console.log('Migration executed successfully!');
  } catch (err: unknown) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
        console.log('Transaction rolled back');
      } catch (rollbackErr: unknown) {
        console.error('Rollback failed:', rollbackErr instanceof Error ? rollbackErr.message : rollbackErr);
      }
    }
    console.error('Migration failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
