import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { currentChannel } from '@/lib/session';
import { configured, dropSettingsCache, LANGUAGES } from '@/lib/translator';

export const dynamic = 'force-dynamic';

// Saves only the fields that are sent: enabled, cooldown (0-600 s), language, mods.
export async function POST(req: NextRequest) {
  const ch = await currentChannel();
  if (!ch) return NextResponse.json({ error: 'Sign in with Kick first.' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const row: Record<string, unknown> = { channel_id: ch.id, updated_at: new Date().toISOString() };
  if ('enabled' in b) {
    if (b.enabled === true && !configured()) return NextResponse.json({ error: 'The translation key is missing on the server.' }, { status: 400 });
    row.enabled = b.enabled === true;
  }
  if ('cooldown' in b) {
    const c = Math.round(Number(b.cooldown));
    if (!Number.isFinite(c) || c < 0 || c > 600) return NextResponse.json({ error: 'Pause must be 0 to 600 seconds.' }, { status: 400 });
    row.cooldown_seconds = c;
  }
  if ('language' in b) {
    if (!LANGUAGES[String(b.language)]) return NextResponse.json({ error: 'That language is not available yet.' }, { status: 400 });
    row.home_language = String(b.language);
  }
  if ('mods' in b) row.mods_can_toggle = b.mods === true;
  const { error } = await db().from('settings').upsert(row, { onConflict: 'channel_id' });
  if (error) return NextResponse.json({ error: 'Could not save.' }, { status: 500 });
  dropSettingsCache(ch.id);
  return NextResponse.json({ ok: true });
}
