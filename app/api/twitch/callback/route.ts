import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { exchangeCode, subscribeChat, whoAmI, appUrl } from '@/lib/twitch';
import { encrypt, unsign } from '@/lib/crypto';
import { SESSION_COOKIE, cookieOpts, makeSession, attachChannel } from '@/lib/session';

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

    // Joins the account you're already signed in to (say Kick), or makes one.
    const { channelId, accountId } = await attachChannel('twitch', me.id, me.name);
    // Twitch needs no saved token (the bot runs on the app's own). This marker just says "connected".
    await db().from('channels').update({ access_token_enc: encrypt('twitch'), refresh_token_enc: null, token_expires_at: null }).eq('id', channelId);
    await subscribeChat(me.id);

    const res = back('connected');
    res.cookies.set(SESSION_COOKIE, makeSession(accountId), cookieOpts(60 * 60 * 24 * 30));
    res.cookies.delete('cc_tlogin');
    return res;
  } catch (e) {
    console.error('Twitch sign-in failed:', (e as Error).message);
    return back('error');
  }
}
