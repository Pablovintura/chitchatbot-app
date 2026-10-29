import { NextResponse } from 'next/server';
import { currentChannel } from '@/lib/session';
import { sendChat } from '@/lib/kick';

export const dynamic = 'force-dynamic';

// Posts one line in the signed-in channel's chat, so you can see the link works.
export async function POST() {
  const ch = await currentChannel();
  if (!ch) return NextResponse.json({ error: 'Sign in with Kick first.' }, { status: 401 });
  try {
    await sendChat(ch.id, '🌐 ChitChatBot: hola chat, I am alive!');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
