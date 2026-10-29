import { NextRequest, NextResponse } from 'next/server';
import { newLogin, twitchReady } from '@/lib/twitch';
import { sign } from '@/lib/crypto';
import { cookieOpts } from '@/lib/session';

export const dynamic = 'force-dynamic';

// /api/twitch/login = a streamer connecting their channel. /api/twitch/login?bot=1 = the bot account saying yes (once).
export async function GET(req: NextRequest) {
  if (!twitchReady()) return new NextResponse('Twitch app settings are missing.', { status: 500 });
  const kind = req.nextUrl.searchParams.get('bot') === '1' ? 'bot' : 'streamer';
  const l = newLogin(kind);
  const res = NextResponse.redirect(l.url);
  res.cookies.set('cc_tlogin', sign(`${l.state}:${kind}`), cookieOpts(600));
  return res;
}
