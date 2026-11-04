-- Optional but recommended: lets the bot ADD to a channel's monthly character count inside the database,
-- so two busy chats (or two servers) can never overwrite each other's numbers.
-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to run again.
-- Until you run it, the bot quietly uses a slower read-then-write instead.
create or replace function add_usage(p_account uuid, p_month date, p_chars bigint)
returns void
language sql
security definer
set search_path = public
as $$
  insert into usage (account_id, month, characters)
  values (p_account, p_month, p_chars)
  on conflict (account_id, month)
  do update set characters = usage.characters + excluded.characters;
$$;
revoke all on function add_usage(uuid, date, bigint) from public, anon, authenticated;
