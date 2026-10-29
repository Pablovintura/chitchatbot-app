import { cookies } from 'next/headers';
import { db } from './supabase';
import { sign, unsign } from './crypto';

export const SESSION_COOKIE = 'cc_session';
export const cookieOpts = (maxAge: number) => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge });

export const makeSession = (accountId: string) => sign(accountId);

// The signed-in Kick channel, or null.
export async function currentChannel() {
  const id = unsign(cookies().get(SESSION_COOKIE)?.value);
  if (!id) return null;
  const { data } = await db().from('channels').select('id, account_id, channel_name, platform_user_id').eq('account_id', id).eq('platform', 'kick').maybeSingle();
  return data as { id: string; account_id: string; channel_name: string; platform_user_id: string } | null;
}
