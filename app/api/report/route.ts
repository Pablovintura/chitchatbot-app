import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Bug reports from /report.html. Stores only what was typed. No address, no browser details.
const AREAS = ['extension', 'bot', 'website'];
const hits = new Map<string, number[]>(); // per visitor, to keep the form from being spammed (in memory only)

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  if (b.website) return NextResponse.json({ ok: true }); // hidden field only bots fill in

  const who = (req.headers.get('x-forwarded-for') || 'x').split(',')[0].trim();
  const now = Date.now();
  const recent = (hits.get(who) || []).filter(t => now - t < 3600000);
  if (recent.length >= 5) return NextResponse.json({ error: "That's a lot of bugs for one hour. Try again later." }, { status: 429 });

  const area = String(b.area || '');
  const message = String(b.message || '').trim();
  const contact = String(b.contact || '').trim();
  if (!AREAS.includes(area)) return NextResponse.json({ error: 'Pick what broke.' }, { status: 400 });
  if (message.length < 10) return NextResponse.json({ error: 'Tell us a bit more. A sentence or two is plenty.' }, { status: 400 });
  if (message.length > 2000 || contact.length > 120) return NextResponse.json({ error: 'That is a bit long. Shorten it and try again.' }, { status: 400 });

  const { error } = await db().from('reports').insert({ area, message, contact: contact || null });
  if (error) return NextResponse.json({ error: "Couldn't send it. Try again in a moment." }, { status: 500 });

  recent.push(now);
  hits.set(who, recent);
  if (hits.size > 2000) hits.clear();
  return NextResponse.json({ ok: true });
}
