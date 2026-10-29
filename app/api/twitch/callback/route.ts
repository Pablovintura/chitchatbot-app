import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { exchangeCode, subscribeChat, whoAmI, appUrl } from '@/lib/twitch';
import { encrypt, unsign } from '@/lib/crypto';
import { SESSION_COOKIE, cookieOpts, makeSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const back = (s: string) => NextResponse.redirect(`${appUrl()}/dashboard?twitch=${s}`);
  if (q.get('error')) return back('denied');

  const login = unsign(req.cookies.get('cc_tlogin')?.value);
  const [state, kind] = (login || '').split(':');
  const code = q.get('code');
  if (!login || !code || !state || state !== q.get('state')) return back('expired');

  try {
    const t = await exchangeCode(code);
    // The bot account saying yes: nothing to save, Twitch remembers the permission.
    if (kind === 'bot') { const res = back('botok'); res.cookies.delete('cc_tlogin'); return res; }

    const me = await whoAmI(t.access_token); // the token is used for this one call and then dropped

    // One account per Twitch channel. Signing in again reuses it.
    const found = await db().from('channels').select('id, account_id').eq('platform', 'twitch').eq('platform_user_id', me.id).maybeSingle();
    let channelId = found.data?.id as string | undefined;
    let accountId = found.data?.account_id as string | undefined;
    if (!channelId) {
      const acc = await db().from('accounts').insert({ display_name: me.name }).select('id').single();
      if (acc.error) throw new Error(acc.error.message);
      accountId = acc.data.id as string;
      const ch = await db().from('channels').insert({ account_id: accountId, platform: 'twitch', platform_user_id: me.id, channel_name: me.name }).select('id').single();
      if (ch.error) throw new Error(ch.error.message);
      channelId = ch.data.id as string;
      await db().from('settings').insert({ channel_id: channelId });
    } else {
      await db().from('channels').update({ channel_name: me.name }).eq('id', channelId);
    }
    // Twitch needs no saved token (the bot runs on the app's own). This marker just says "connected".
    await db().from('channels').update({ access_token_enc: encrypt('twitch'), refresh_token_enc: null, token_expires_at: null }).eq('id', channelId);
    await subscribeChat(me.id);

    const res = back('connected');
    res.cookies.set(SESSION_COOKIE, makeSession(accountId!), cookieOpts(60 * 60 * 24 * 30));
    res.cookies.delete('cc_tlogin');
    return res;
  } catch (e) {
    console.error('Twitch sign-in failed:', (e as Error).message);
    return back('error');
  }
}
