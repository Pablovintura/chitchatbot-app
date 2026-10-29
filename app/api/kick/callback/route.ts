import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode, saveTokens, subscribeChat, whoAmI, appUrl } from '@/lib/kick';
import { unsign } from '@/lib/crypto';
import { SESSION_COOKIE, cookieOpts, makeSession, attachChannel } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const back = (s: string) => NextResponse.redirect(`${appUrl()}/dashboard?kick=${s}`);
  if (q.get('error')) return back('denied');

  const login = unsign(req.cookies.get('cc_login')?.value);
  const [state, verifier] = (login || '').split(':');
  const code = q.get('code');
  if (!login || !code || !state || state !== q.get('state')) return back('expired');

  try {
    const t = await exchangeCode(code, verifier);
    const me = await whoAmI(t.access_token);

    // Joins the account you're already signed in to (say Twitch), or makes one.
    const { channelId, accountId } = await attachChannel('kick', me.id, me.name);
    await saveTokens(channelId, t);
    await subscribeChat(channelId, me.id);

    const res = back('connected');
    res.cookies.set(SESSION_COOKIE, makeSession(accountId), cookieOpts(60 * 60 * 24 * 30));
    res.cookies.delete('cc_login');
    return res;
  } catch (e) {
    console.error('Kick sign-in failed:', (e as Error).message);
    return back('error');
  }
}
