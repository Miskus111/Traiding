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
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
      blocked BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'");
  await db.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT FALSE",
  );
  await db.query(`
    UPDATE users
    SET role = 'admin'
    WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
      AND NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin')
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      prop_firm TEXT NOT NULL,
      program TEXT NOT NULL DEFAULT '',
      account_size TEXT NOT NULL DEFAULT '',
      account_type TEXT NOT NULL DEFAULT '',
      market TEXT NOT NULL DEFAULT '',
      strategy TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'challenge' CHECK (status IN ('challenge', 'verification', 'funded', 'failed', 'payout received', 'refunded', 'archived')),
      purchase_date DATE,
      ended_date DATE,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
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
      account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
      prop_firm TEXT NOT NULL,
      program TEXT NOT NULL DEFAULT '',
      amount NUMERIC(14, 2) NOT NULL,
      currency TEXT NOT NULL CHECK (currency IN ('CZK', 'EUR', 'USD')),
      payout_date DATE NOT NULL,
      split INTEGER NOT NULL DEFAULT 80 CHECK (split >= 0 AND split <= 100),
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
      invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
      payout_id UUID REFERENCES payouts(id) ON DELETE SET NULL,
      file_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_path TEXT NOT NULL,
      content_type TEXT NOT NULL DEFAULT '',
      file_size INTEGER NOT NULL DEFAULT 0,
      ai_status TEXT NOT NULL DEFAULT 'pending' CHECK (ai_status IN ('pending', 'analyzed', 'failed', 'skipped')),
      extracted_json JSONB,
      confidence INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(
    "CREATE INDEX IF NOT EXISTS invoices_user_date_idx ON invoices(user_id, invoice_date DESC)",
  );
  await db.query(
    "CREATE INDEX IF NOT EXISTS payouts_user_date_idx ON payouts(user_id, payout_date DESC)",
  );
  await db.query(
    "CREATE INDEX IF NOT EXISTS accounts_user_status_idx ON accounts(user_id, status, created_at DESC)",
  );
  await db.query(
    "CREATE INDEX IF NOT EXISTS documents_user_created_idx ON documents(user_id, created_at DESC)",
  );
  await db.query(
    "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE SET NULL",
  );
  await db.query(
    "ALTER TABLE payouts ADD COLUMN IF NOT EXISTS program TEXT NOT NULL DEFAULT ''",
  );
  await db.query(
    "ALTER TABLE payouts ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE SET NULL",
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
