import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { currentChannel } from '@/lib/session';
import { configured, dropSettingsCache, LANGUAGES, SKIP_MAX, skipKey } from '@/lib/translator';

export const dynamic = 'force-dynamic';

// Saves only the fields that are sent: enabled, cooldown (0-600 s), language, mods, skipAdd / skipRemove (one username).
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const ch = await currentChannel(typeof b.platform === 'string' ? b.platform : null);
  if (!ch) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
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
  if ('skipAdd' in b || 'skipRemove' in b) {
    const { data } = await db().from('settings').select('skip_list').eq('channel_id', ch.id).maybeSingle();
    let list: string[] = Array.isArray(data?.skip_list) ? data.skip_list : [];
    if ('skipAdd' in b) {
      const n = String(b.skipAdd || '').trim().replace(/^@+/, '');
      if (!/^[\w-]{1,40}$/.test(n)) return NextResponse.json({ error: 'That does not look like a username.' }, { status: 400 });
      if (list.some(x => skipKey(x) === skipKey(n))) return NextResponse.json({ error: `${n} is already skipped. Nice try.` }, { status: 400 });
      if (list.length >= SKIP_MAX) return NextResponse.json({ error: `The list is full (${SKIP_MAX}). Someone has to go.` }, { status: 400 });
      list = [n, ...list];
    } else {
      const k = skipKey(String(b.skipRemove || ''));
      list = list.filter(x => skipKey(x) !== k);
    }
    row.skip_list = list;
  }
  const { error } = await db().from('settings').upsert(row, { onConflict: 'channel_id' });
  if (error) return NextResponse.json({ error: 'Could not save.' }, { status: 500 });
  dropSettingsCache(ch.id);
  if ('enabled' in row) await db().from('settings').update({ toggled_by: 'the dashboard', toggled_at: new Date().toISOString() }).eq('channel_id', ch.id).then(() => {}, () => {}); // note only; fine if the columns aren't there yet
  return NextResponse.json({ ok: true, skip: row.skip_list });
}
