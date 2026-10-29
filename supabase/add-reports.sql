-- Run once in Supabase: SQL Editor > New query > paste > Run.
-- Bug reports from chitchatbot.stream/report.html. Only what the person types: where it broke, what happened, and an optional email.
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  area text not null check (area in ('extension','bot','website')),
  message text not null,
  contact text
);
alter table reports enable row level security;
grant all on reports to service_role;
