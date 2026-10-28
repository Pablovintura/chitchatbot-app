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

## Milestones

1. Foundation (this one): project, database tables, brand styling
2. Sign in with Kick
3. Bot: read chat, translate, reply
4. Dashboard settings
5. Twitch
6. Plans and Stripe
