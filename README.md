# ChitChatBot app

The ChitChatBot website, streamer dashboard and translation bot server.

- Next.js 14 (App Router) + TypeScript
- Supabase (Postgres) for accounts, channels, settings and monthly usage
- Kick and Twitch sign-in, Cloudflare Workers AI for translation, Stripe for plans (later milestones)

## Run locally

```
cp .env.example .env.local   # fill in the values
npm install
npm run dev
```

## Database

Run `supabase/schema.sql` once in the Supabase SQL Editor.

## Kick bot (test build)

Same linking as PxVbot (OAuth with PKCE, signed webhooks, `chat.message.sent` subscription), but fully separate: its own Kick app and its own database.

- `/dashboard` is a small test page: sign in with Kick, turn the translator on, send a test line.
- `/api/kick/login` and `/api/kick/callback` link the channel. Tokens are saved encrypted.
- `/api/kick/webhook` receives chat from Kick (signature checked) and posts `🌐 name: english` for other languages.
- Chat messages are never stored. Only a character count per month is kept.
