-- Run once in Supabase: SQL Editor > New query > paste > Run.
alter table settings add column if not exists mods_can_toggle boolean not null default false;
