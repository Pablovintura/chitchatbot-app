import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { currentChannel } from '@/lib/session';
import { configured, dropSettingsCache } from '@/lib/translator';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ch = await currentChannel();
  if (!ch) return NextResponse.json({ error: 'Sign in with Kick first.' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const enabled = b.enabled === true;
  const cooldown = Math.round(Number(b.cooldown));
  if (!Number.isFinite(cooldown) || cooldown < 0 || cooldown > 600) return NextResponse.json({ error: 'Cooldown must be 0 to 600 seconds.' }, { status: 400 });
  if (enabled && !configured()) return NextResponse.json({ error: 'Add CF_ACCOUNT_ID and CF_AI_TOKEN in the hosting environment first.' }, { status: 400 });
  const { error } = await db().from('settings').upsert({ channel_id: ch.id, enabled, cooldown_seconds: cooldown, updated_at: new Date().toISOString() }, { onConflict: 'channel_id' });
  if (error) return NextResponse.json({ error: 'Could not save.' }, { status: 500 });
  dropSettingsCache(ch.id);
  return NextResponse.json({ enabled, cooldown });
}
