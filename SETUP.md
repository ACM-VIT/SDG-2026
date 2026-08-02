# SDG Ideathon — Setup

React + Vite frontend with a [Convex](https://convex.dev) backend and
[Convex Auth](https://labs.convex.dev/auth) (Google OAuth).

## Features

- Google sign-in
- Create a team (name + one SDG track) → get a 6-char invite code
- Join a team by invite code (max 4 members)
- "Teams forming now" live list
- Submit ideas: title, description, and document attachments (Convex file storage)
- Admin dashboard (team count, members, all submissions + documents) —
  gated by the `isAdmin` flag on the `users` table. Emails in the
  comma-separated `ADMIN_EMAILS` env var (set it on the deployment, see
  `convex/auth.ts`) get the flag automatically on first sign-in; other
  admins can be granted by setting `isAdmin: true` on their user row in
  the Convex dashboard.
- Live demo tab is a placeholder for the workshop demo

## Run locally

Two terminals:

```sh
# 1. backend (local anonymous deployment — no Convex account needed)
CONVEX_AGENT_MODE=anonymous npx convex dev

# 2. frontend
npm run dev
```

`.env.local` (already generated) points the frontend at the local deployment.

## Google OAuth credentials (required for sign-in)

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
   and create an **OAuth client ID** (type: Web application).
2. Add the authorized redirect URI:
   - local dev: `http://127.0.0.1:3211/api/auth/callback/google`
   - production: `https://<your-deployment>.convex.site/api/auth/callback/google`
3. Set the credentials on the deployment:

```sh
CONVEX_AGENT_MODE=anonymous npx convex env set AUTH_GOOGLE_ID <client-id>
CONVEX_AGENT_MODE=anonymous npx convex env set AUTH_GOOGLE_SECRET <client-secret>
```

## Deploying to a real (cloud) Convex deployment

1. `npx convex login`, then `npx convex dev` once to create the project.
2. Re-set the auth env vars on that deployment:

```sh
node scripts/generateAuthKeys.mjs .auth-keys
npx convex env set JWT_PRIVATE_KEY -- "$(cat .auth-keys/JWT_PRIVATE_KEY.txt)"
npx convex env set JWKS -- "$(cat .auth-keys/JWKS.txt)"
npx convex env set SITE_URL <your-frontend-url>
npx convex env set AUTH_GOOGLE_ID <client-id>
npx convex env set AUTH_GOOGLE_SECRET <client-secret>
npx convex env set ADMIN_EMAILS ayaankhatri@outlook.com
```

3. `npm run build` and host `dist/` anywhere (Vercel/Netlify), with
   `VITE_CONVEX_URL` set to the deployment URL at build time.

## Where things live

- `convex/schema.ts` — tables: teams, memberships, submissions (+ auth tables)
- `convex/teams.ts` — create/join/leave/list teams
- `convex/ideas.ts` — idea submission + file uploads
- `convex/admin.ts` — admin-only overview
- `convex/tracks.ts` — the 6 SDG tracks (shared with the frontend)
- `src/components/` — SignIn, FindTeam, TeamDashboard, AdminDashboard
