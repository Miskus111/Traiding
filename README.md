# Trader Cost Hub

Prop trading is a business. Track it like one.

Trader Cost Hub is a multi-user SaaS dashboard for tracking prop firm challenge
fees, resets, refunds, payouts and real ROI in one clean workspace.

## Features

- user registration and sign-in,
- hashed passwords and httpOnly session cookies,
- Postgres database for accounts, costs and payouts,
- private user data separation,
- manual-first workflow: account -> cost -> payout -> ROI,
- prop accounts with status, market and strategy,
- Vercel Blob storage for invoice and payout proof files,
- optional AI document preview without automatic form filling,
- monthly report and creator motivation PDF,
- ROI ranking by account and prop firm,
- trust-first Prop Firm Deals section with affiliate disclosure,
- admin panel for user management.

## Vercel setup

The project is prepared for Vercel as a standard Next.js app.

Add a Postgres database in Vercel. The app can use any one of these variables,
including the automatic variables created by the Neon integration:

```txt
POSTGRES_URL=...
DATABASE_URL=...
DATABASE_URL_UNPOOLED=...
POSTGRES_PRISMA_URL=...
POSTGRES_URL_NON_POOLING=...
```

Also set:

```txt
SESSION_SECRET=long-random-secret
BLOB_READ_WRITE_TOKEN=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-luna
```

Database tables are created automatically on the first API request.

If deployment says the database is missing, check `Project Settings ->
Environment Variables` in Vercel and make sure at least one database variable is
available for `Production`.

## Local development

Node.js `22.x` is required.

```bash
npm install
npm run dev
```

For a local database, set `.env.local`:

```txt
POSTGRES_URL=postgres://user:password@localhost:5432/trader_cost_hub
SESSION_SECRET=local-secret-change-me
```

## Document upload note

The current version stores PDF, image, TXT and CSV files in Vercel Blob. AI
analysis is optional and only shows a preview. Users must enter and confirm
costs or payouts manually.

## Affiliate and risk disclosure

Some prop firm links may be paid links. The app avoids guaranteed-profit claims
and focuses on cost tracking, comparison and real ROI. This is not financial
advice. Prop trading is risky.
