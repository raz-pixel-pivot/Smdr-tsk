# Smdr-tsk

A personal daily planner. Next.js (App Router) + Tiptap + Clerk + Neon Postgres (Drizzle) + Vercel Blob, deployed on Vercel. English and Hebrew (full RTL).

## Local development

```bash
npm install
npm run dev
```

`.env.local` (never committed) needs `DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `ALLOWED_EMAIL` (comma-separated), `BLOB_READ_WRITE_TOKEN` (a **private** Blob store) and `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`. `vercel env pull .env.local` fetches the non-sensitive ones; `scripts/set-clerk-keys.sh` sets the Clerk keys locally and on Vercel without printing them.

`DEV_AUTH_BYPASS=1` in `.env.local` skips sign-in under `npm run dev` only, using a separate `dev-local` user. A `dev_email` cookie switches to another local user (to try sharing). Both are ignored in production builds. Local dev uses the same database as production, so clean up test users afterwards.

## Access, sharing and files

- Someone can use the planner if one of their verified emails is in `ALLOWED_EMAIL`, or if a task has been shared with that email.
- Each person has their own planner. A task's owner can share it by email as "Can edit" or "Can view". Labels stay personal: each person files a shared task under their own labels. Only the owner can delete a task or change who it's shared with; others can remove it from their list.
- Files live in a private Blob store. The app serves them at `/api/files/<id>` after checking access to the task. A file can also get a public link (`/s/<token>`) that works without signing in until it's switched off.

## Google Calendar

Uses the Google account connected through Clerk, with the `calendar.events` scope. Clerk needs **custom Google credentials** for this (Clerk dashboard → Configure → SSO connections → Google → "Use custom credentials"), from a Google Cloud project with the Google Calendar API enabled and an OAuth client whose redirect URI is the one Clerk shows. While the Google consent screen is in "Testing", only the test users listed there can connect.

## Database

```bash
npm run db:generate   # after editing src/db/schema.ts
npm run db:migrate    # applies migrations using .env.local
```

## Layout

- `src/db` schema and connection
- `src/server` auth check, task access (`access.ts`), data loading, server actions, Google Calendar calls, file serving (every query is scoped to the signed-in user or to tasks shared with them)
- `src/store` client store with optimistic updates and undo
- `src/components` screens: Daily (date strip, list, capture), TaskPage + Editor, Projects, Timeline, Settings
- `src/i18n` English and Hebrew strings
