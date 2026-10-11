# Smdr-tsk

A personal daily planner. Next.js (App Router) + Tiptap + Clerk + Neon Postgres (Drizzle) + Vercel Blob, deployed on Vercel. English and Hebrew (full RTL).

## Local development

```bash
npm install
npm run dev
```

`.env.local` (never committed) needs `DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `ALLOWED_EMAIL` (comma-separated), `BLOB_READ_WRITE_TOKEN` and `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`. `vercel env pull .env.local` fetches the non-sensitive ones; `scripts/set-clerk-keys.sh` sets the Clerk keys locally and on Vercel without printing them.

`DEV_AUTH_BYPASS=1` in `.env.local` skips sign-in under `npm run dev` only, using a separate `dev-local` user. It is ignored in production builds.

## Database

```bash
npm run db:generate   # after editing src/db/schema.ts
npm run db:migrate    # applies migrations using .env.local
```

## Layout

- `src/db` schema and connection
- `src/server` auth check, data loading, server actions (every query is scoped to the signed-in user)
- `src/store` client store with optimistic updates and undo
- `src/components` screens: Daily (date strip, list, capture), TaskPage + Editor, Projects, Timeline, Settings
- `src/i18n` English and Hebrew strings
