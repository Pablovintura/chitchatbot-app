import { NextResponse } from 'next/server';
import { newLogin } from '@/lib/kick';
import { sign } from '@/lib/crypto';
import { cookieOpts } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!process.env.KICK_CLIENT_ID || !process.env.KICK_CLIENT_SECRET) return new NextResponse('Kick app settings are missing.', { status: 500 });
  const l = newLogin();
  const res = NextResponse.redirect(l.url);
  res.cookies.set('cc_login', sign(`${l.state}:${l.verifier}`), cookieOpts(600));
  return res;
}
