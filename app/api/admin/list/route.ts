import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { currentChannel } from '@/lib/session';
import { isAdmin } from '@/lib/admin';
import { FREE_CAP, LANGUAGES } from '@/lib/translator';

export const dynamic = 'force-dynamic';

// Who signed up and how much they used. No chat text exists anywhere to show.
export async function GET() {
  if (!isAdmin(await currentChannel('kick'))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const month = new Date().toISOString().slice(0, 8) + '01';
  const [ch, st, us, ac] = await Promise.all([
    db().from('channels').select('id, account_id, channel_name, created_at, access_token_enc, platform').order('created_at', { ascending: false }).limit(500),
    db().from('settings').select('channel_id, enabled, home_language'),
    db().from('usage').select('account_id, characters').eq('month', month),
    db().from('accounts').select('id, plan')
  ]);
  const sMap = new Map<string, any>((st.data || []).map((r: any): [string, any] => [r.channel_id, r]));
  const uMap = new Map<string, number>((us.data || []).map((r: any): [string, number] => [r.account_id, Number(r.characters)]));
  const pMap = new Map<string, string>((ac.data || []).map((r: any): [string, string] => [r.id, r.plan]));
  const rows = (ch.data || []).map((c: any) => {
    const s: any = sMap.get(c.id);
    return {
      id: c.id, account: c.account_id, name: c.channel_name, platform: c.platform, joined: c.created_at, linked: Boolean(c.access_token_enc),
      on: Boolean(s?.enabled), language: LANGUAGES[s?.home_language || 'en'] || 'English',
      plan: String(pMap.get(c.account_id) || 'free'), used: uMap.get(c.account_id) || 0
    };
  });
  return NextResponse.json({ cap: FREE_CAP, rows });
}
