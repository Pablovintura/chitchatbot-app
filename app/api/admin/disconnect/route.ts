import { NextRequest, NextResponse } from 'next/server';
import { currentChannel } from '@/lib/session';
import { isAdmin, disconnectChannel } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isAdmin(await currentChannel('kick'))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  if (typeof b.id !== 'string') return NextResponse.json({ error: 'Missing channel.' }, { status: 400 });
  await disconnectChannel(b.id);
  return NextResponse.json({ ok: true });
}
