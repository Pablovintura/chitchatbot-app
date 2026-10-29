import { NextResponse } from 'next/server';
import { currentChannel } from '@/lib/session';
import { sendChat as kickSend } from '@/lib/kick';
import { sendChat as twitchSend } from '@/lib/twitch';

export const dynamic = 'force-dynamic';

// Posts one line in the signed-in channel's chat (Kick or Twitch), so you can see the link works.
export async function POST() {
  const ch = await currentChannel();
  if (!ch) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  try {
    const line = '🌐 ChitChatBot: hola chat, I am alive!';
    if (ch.platform === 'twitch') await twitchSend(ch.platform_user_id, line); else await kickSend(ch.id, line);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
