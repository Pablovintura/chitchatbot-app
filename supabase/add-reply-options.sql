-- Optional. Lets each streamer tweak how the bot's translated line looks in chat.
-- Without it everything still works with the default look: "🇪🇸 pedro: hello".
alter table settings add column if not exists reply_style text default 'colon';
alter table settings add column if not exists reply_flag boolean default true;
alter table settings add column if not exists reply_original boolean default false;
