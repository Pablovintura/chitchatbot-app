import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { currentChannel } from '@/lib/session';
import { configured } from '@/lib/translator';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ch = await currentChannel();
  if (!ch) return NextResponse.json({ connected: false, kickReady: Boolean(process.env.KICK_CLIENT_ID && process.env.KICK_CLIENT_SECRET), translatorReady: configured() });
  const { data } = await db().from('settings').select('enabled, cooldown_seconds').eq('channel_id', ch.id).maybeSingle();
  return NextResponse.json({
    connected: true, channel: ch.channel_name, translatorReady: configured(),
    enabled: Boolean(data?.enabled), cooldown: Number(data?.cooldown_seconds ?? 30)
  });
}
