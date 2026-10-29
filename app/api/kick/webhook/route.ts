import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook } from '@/lib/kick';
import { onChat } from '@/lib/translator';

export const dynamic = 'force-dynamic';

// Kick posts every chat message of connected channels here. Signed, so anything unsigned is refused.
export async function POST(req: NextRequest) {
  const raw = Buffer.from(await req.arrayBuffer());
  let ok = false;
  try { ok = await verifyWebhook(req.headers, raw); } catch (e) { console.error('Webhook check failed:', (e as Error).message); }
  if (!ok) return new NextResponse('Invalid webhook signature.', { status: 401 });

  if (req.headers.get('kick-event-type') === 'chat.message.sent') {
    try {
      const p = JSON.parse(raw.toString('utf8'));
      if (p?.sender?.user_id && p?.broadcaster?.user_id) {
        // Answer Kick right away, translate afterwards.
        void onChat({
          messageId: req.headers.get('kick-event-message-id'),
          broadcasterId: String(p.broadcaster.user_id),
          senderId: String(p.sender.user_id),
          username: String(p.sender.username || ''),
          text: String(p.content || '')
        });
      }
    } catch { /* ignore malformed */ }
  }
  return new NextResponse('ok');
}
