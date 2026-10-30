import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { currentChannel, accountChannels, sessionAccount } from '@/lib/session';
import { configured, usedThisMonth, FREE_CAP } from '@/lib/translator';
import { isAdmin } from '@/lib/admin';
import { twitchReady } from '@/lib/twitch';

export const dynamic = 'force-dynamic';

async function cards(accountId: string) {
  const list = (await accountChannels(accountId)).filter(c => c.connected);
  const out = [];
  for (const c of list) {
    const { data } = await db().from('settings').select('*').eq('channel_id', c.id).maybeSingle();
    out.push({ platform: c.platform, name: c.channel_name, enabled: Boolean(data?.enabled), by: data?.toggled_by ? String(data.toggled_by) : '', at: data?.toggled_at ? String(data.toggled_at) : '' });
  }
  return out;
}

export async function GET(req: NextRequest) {
  const want = req.nextUrl.searchParams.get('p');
  const ch = (await currentChannel(want)) || (await currentChannel());
  if (!ch) return NextResponse.json({ connected: false, twitchReady: twitchReady(), kickReady: Boolean(process.env.KICK_CLIENT_ID && process.env.KICK_CLIENT_SECRET), translatorReady: configured() });
  // Every column, so one missing column can't make the whole read fail (and switch the translator off).
  const { data } = await db().from('settings').select('*').eq('channel_id', ch.id).maybeSingle();
  return NextResponse.json({
    connected: true, platform: ch.platform, channel: ch.channel_name, translatorReady: configured(), twitchReady: twitchReady(), kickReady: Boolean(process.env.KICK_CLIENT_ID && process.env.KICK_CLIENT_SECRET),
    channels: await cards(ch.account_id),
    admin: isAdmin(await currentChannel('kick')),
    enabled: Boolean(data?.enabled), by: data?.toggled_by ? String(data.toggled_by) : '', at: data?.toggled_at ? String(data.toggled_at) : '', cooldown: Number(data?.cooldown_seconds ?? 30),
    language: String(data?.home_language || 'en'), mods: Boolean(data?.mods_can_toggle), replyStyle: data?.reply_style === 'lang' ? 'lang' : 'colon', replyFlag: data?.reply_flag !== false, replyOriginal: data?.reply_original === true, skip: Array.isArray(data?.skip_list) ? data.skip_list : [],
    used: await usedThisMonth(ch.account_id), cap: FREE_CAP
  });
}
