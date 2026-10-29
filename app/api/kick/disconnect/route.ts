import { NextResponse } from 'next/server';
import { currentChannel, SESSION_COOKIE } from '@/lib/session';
import { disconnectChannel } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function POST() {
  const ch = await currentChannel();
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  if (ch) await disconnectChannel(ch.id);
  return res;
}
