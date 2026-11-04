import { NextRequest, NextResponse } from 'next/server';
import { currentChannel } from '@/lib/session';
import { sendChat as kickSend } from '@/lib/kick';
import { sendChat as twitchSend } from '@/lib/twitch';
import { detectLanguage, flagFor } from '@/lib/detect';
import { translateText, LANGUAGES } from '@/lib/translator';
import { db } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Tests the translation pipeline or posts one line in the signed-in channel's chat.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const ch = await currentChannel(typeof b.platform === 'string' ? b.platform : null);
  if (!ch) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  // 1. Live translation test mode (called from dashboard test box)
  if (typeof b.text === 'string' && b.text.trim()) {
    try {
      const text = b.text.trim();
      const detected = detectLanguage(text) || 'es';
      const flag = flagFor(detected);

      // Read streamer's home language
      const { data } = await db().from('settings').select('home_language, reply_style, reply_flag, reply_original').eq('channel_id', ch.id).maybeSingle();
      const home = data?.home_language || 'en';

      const translated = await translateText(text, detected, home);
      const who = 'TestUser' + (data?.reply_style === 'lang' ? ` (${LANGUAGES[detected] || detected})` : '');
      const flagPart = data?.reply_flag !== false ? `${flag} ` : '';
      const origPart = data?.reply_original ? ` [${text}]` : '';
      const line = `${flagPart}${who}: ${translated}${origPart}`;

      if (b.sendToChat) {
        if (ch.platform === 'twitch') await twitchSend(ch.platform_user_id, line);
        else await kickSend(ch.id, line);
      }

      return NextResponse.json({
        ok: true,
        text,
        detected,
        flag,
        langName: LANGUAGES[detected] || detected,
        translated,
        line,
        sentToChat: Boolean(b.sendToChat)
      });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 502 });
    }
  }

  // 2. Default ping test ("Say hello")
  try {
    const line = '🌐 ChitChatBot: hola chat, I am alive!';
    if (ch.platform === 'twitch') await twitchSend(ch.platform_user_id, line); else await kickSend(ch.id, line);
    return NextResponse.json({ ok: true, line, sentToChat: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
