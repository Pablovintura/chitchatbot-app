import { NextRequest, NextResponse } from 'next/server';
import { currentChannel, accountChannels, sessionAccount, SESSION_COOKIE } from '@/lib/session';
import { disconnectChannel } from '@/lib/admin';

export const dynamic = 'force-dynamic';

// Disconnects one channel (platform in the body), or the one you're signed in with. You stay signed in while another channel is connected.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const ch = await currentChannel(typeof b.platform === 'string' ? b.platform : null);
  const res = NextResponse.json({ ok: true });
  if (ch) await disconnectChannel(ch.id);
  const acc = sessionAccount();
  const left = acc ? (await accountChannels(acc)).some(c => c.connected) : false;
  if (!left) res.cookies.delete(SESSION_COOKIE);
  return res;
}
