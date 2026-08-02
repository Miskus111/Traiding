import { Pool, type QueryResultRow } from "pg";

let pool: Pool | null = null;
let schemaReady = false;

function getDatabaseUrl() {
  return (
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL_NON_POOLING
  );
}

export function hasDatabase() {
  return Boolean(getDatabaseUrl());
}

function getPool() {
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error(
      "Missing Postgres connection string. Add POSTGRES_URL, DATABASE_URL, DATABASE_URL_UNPOOLED, or POSTGRES_PRISMA_URL in Vercel.",
    );
  }

  pool ??= new Pool({
    connectionString,
    ssl:
      connectionString.includes("localhost") ||
      connectionString.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false },
  });

  return pool;
}

export async function ensureSchema() {
  if (schemaReady) return;

  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      prop_firm TEXT NOT NULL,
      program TEXT NOT NULL DEFAULT '',
      amount NUMERIC(14, 2) NOT NULL,
      currency TEXT NOT NULL CHECK (currency IN ('CZK', 'EUR', 'USD')),
      invoice_date DATE NOT NULL,
      file_name TEXT,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS payouts (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      prop_firm TEXT NOT NULL,
      amount NUMERIC(14, 2) NOT NULL,
      currency TEXT NOT NULL CHECK (currency IN ('CZK', 'EUR', 'USD')),
      payout_date DATE NOT NULL,
      split INTEGER NOT NULL DEFAULT 80 CHECK (split >= 0 AND split <= 100),
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(
    "CREATE INDEX IF NOT EXISTS invoices_user_date_idx ON invoices(user_id, invoice_date DESC)",
  );
  await db.query(
    "CREATE INDEX IF NOT EXISTS payouts_user_date_idx ON payouts(user_id, payout_date DESC)",
  );

  schemaReady = true;
}

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
) {
  await ensureSchema();
  return getPool().query<T>(text, params);
}
