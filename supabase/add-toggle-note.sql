-- Optional. Lets the dashboard say who flipped the switch ("Paused from Kick chat, 2 min ago").
-- Without it everything still works; the card just says "On." or "Off.".
alter table settings add column if not exists toggled_by text;
alter table settings add column if not exists toggled_at timestamptz;
