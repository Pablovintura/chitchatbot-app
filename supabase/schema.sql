-- ChitChatBot database. Run once in Supabase: SQL Editor > New query > paste > Run.
-- Only what the bot needs is stored. Chat messages are never saved.

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  plan text not null default 'free' check (plan in ('free','starter','pro','community')),
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

-- One row per connected channel (Kick or Twitch; YouTube later).
create table if not exists channels (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  platform text not null check (platform in ('kick','twitch','youtube')),
  platform_user_id text not null,
  channel_name text not null,
  access_token_enc text,      -- encrypted, never stored in plain text
  refresh_token_enc text,     -- encrypted
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (platform, platform_user_id)
);
create index if not exists channels_account_idx on channels(account_id);

-- Translation settings per channel.
create table if not exists settings (
  channel_id uuid primary key references channels(id) on delete cascade,
  enabled boolean not null default false,
  home_language text not null default 'en',
  languages text[] not null default '{}',
  output text not null default 'chat' check (output in ('chat','extension','both')),
  cooldown_seconds int not null default 30 check (cooldown_seconds between 0 and 600),
  updated_at timestamptz not null default now()
);

-- Characters translated per account per month (a number only, no text).
create table if not exists usage (
  account_id uuid not null references accounts(id) on delete cascade,
  month date not null,
  characters bigint not null default 0,
  primary key (account_id, month)
);

-- Lock everything down: only the server (service role key) can read or write.
alter table accounts enable row level security;
alter table channels enable row level security;
alter table settings enable row level security;
alter table usage enable row level security;
