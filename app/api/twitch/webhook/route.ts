import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook, botId } from '@/lib/twitch';
import { onChat } from '@/lib/translator';

export const dynamic = 'force-dynamic';

// Twitch posts every chat message of connected channels here (EventSub). Signed, so anything unsigned is refused.
export async function POST(req: NextRequest) {
  const raw = Buffer.from(await req.arrayBuffer());
  let ok = false;
  try { ok = verifyWebhook(req.headers, raw); } catch (e) { console.error('Twitch webhook check failed:', (e as Error).message); }
  if (!ok) return new NextResponse('Invalid webhook signature.', { status: 401 });

  let p: any = null;
  try { p = JSON.parse(raw.toString('utf8')); } catch { return new NextResponse('ok'); }
  const type = req.headers.get('twitch-eventsub-message-type');

  // Twitch asks once to confirm the address: send its challenge back as plain text.
  if (type === 'webhook_callback_verification') return new NextResponse(String(p?.challenge || ''), { headers: { 'Content-Type': 'text/plain' } });
  if (type === 'revocation') { console.error('Twitch revoked a subscription:', String(p?.subscription?.status || '')); return new NextResponse('ok'); }

  if (type === 'notification' && p?.subscription?.type === 'channel.chat.message') {
    const e = p.event;
    if (e?.chatter_user_id && e?.broadcaster_user_id && e?.message?.text) {
      let mine = '';
      try { mine = await botId(); } catch { /* without the bot id nothing can be sent anyway */ }
      if (String(e.chatter_user_id) !== mine) {
        // Answer Twitch right away, translate afterwards.
        void onChat({
          platform: 'twitch',
          messageId: String(e.message_id || req.headers.get('twitch-eventsub-message-id') || ''),
          broadcasterId: String(e.broadcaster_user_id),
          senderId: String(e.chatter_user_id),
          username: String(e.chatter_user_login || e.chatter_user_name || ''),
          text: String(e.message.text),
          isMod: Array.isArray(e.badges) && e.badges.some((b: any) => ['moderator', 'broadcaster'].includes(String(b?.set_id || '').toLowerCase()))
        });
      }
    }
  }
  return new NextResponse('ok');
}
