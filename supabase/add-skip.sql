-- Run once in Supabase: SQL Editor > New query > paste > Run.
alter table settings add column if not exists skip_list text[] not null default '{}';
