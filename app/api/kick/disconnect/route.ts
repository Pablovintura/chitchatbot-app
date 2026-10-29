import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { currentChannel, SESSION_COOKIE } from '@/lib/session';
import { dropSettingsCache } from '@/lib/translator';

export const dynamic = 'force-dynamic';

// Forgets the saved tokens and turns the bot off. The row stays so signing in again is quick.
export async function POST() {
  const ch = await currentChannel();
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  if (ch) {
    await db().from('channels').update({ access_token_enc: null, refresh_token_enc: null, token_expires_at: null }).eq('id', ch.id);
    await db().from('settings').update({ enabled: false }).eq('channel_id', ch.id);
    dropSettingsCache(ch.id);
  }
  return res;
}
