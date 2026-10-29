import { cookies } from 'next/headers';
import { db } from './supabase';
import { sign, unsign } from './crypto';

export const SESSION_COOKIE = 'cc_session';
export const cookieOpts = (maxAge: number) => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge });

export const makeSession = (accountId: string) => sign(accountId);

export type Chan = { id: string; account_id: string; channel_name: string; platform_user_id: string; platform: 'kick' | 'twitch'; connected: boolean };

export const sessionAccount = () => unsign(cookies().get(SESSION_COOKIE)?.value);

// Every channel on an account, Kick first. "connected" = it still has its sign-in marker (disconnecting clears it).
export async function accountChannels(accountId: string): Promise<Chan[]> {
  const { data } = await db().from('channels').select('id, account_id, channel_name, platform_user_id, platform, access_token_enc').eq('account_id', accountId);
  const rows = ((data || []) as any[]).filter(r => r.platform === 'kick' || r.platform === 'twitch').map(r => ({
    id: r.id, account_id: r.account_id, channel_name: r.channel_name, platform_user_id: r.platform_user_id, platform: r.platform, connected: Boolean(r.access_token_enc)
  })) as Chan[];
  return rows.sort((a, b) => (a.platform === b.platform ? 0 : a.platform === 'kick' ? -1 : 1));
}

// The signed-in channel, or null. With a platform it must be that one; without, the first connected channel (Kick first).
export async function currentChannel(platform?: string | null) {
  const id = sessionAccount();
  if (!id) return null;
  const mine = (await accountChannels(id)).filter(c => c.connected);
  if (platform) return mine.find(c => c.platform === platform) || null;
  return mine[0] || null;
}

// Adds a channel after a sign-in. Signed in already (say on Kick) and connecting Twitch too? It joins the same account.
// A channel that already had its own account moves over, so nothing gets lost. Returns the account to put in the session.
export async function attachChannel(platform: 'kick' | 'twitch', platformUserId: string, name: string) {
  const dbc = db();
  let sessionAcc = sessionAccount();
  if (sessionAcc) {
    const mine = await accountChannels(sessionAcc);
    const same = mine.find(c => c.platform === platform);
    if (!mine.length || (same && same.platform_user_id !== platformUserId)) sessionAcc = null; // a different channel on this platform: plain sign-in
  }
  const found = await dbc.from('channels').select('id, account_id').eq('platform', platform).eq('platform_user_id', platformUserId).maybeSingle();
  let channelId = found.data?.id as string | undefined;
  let accountId = (found.data?.account_id as string | undefined) || undefined;

  if (channelId && accountId) {
    if (sessionAcc && sessionAcc !== accountId) {
      const oldAcc = accountId;
      const mv = await dbc.from('channels').update({ account_id: sessionAcc, channel_name: name }).eq('id', channelId);
      if (mv.error) throw new Error(mv.error.message);
      accountId = sessionAcc;
      const left = await dbc.from('channels').select('id').eq('account_id', oldAcc).limit(1);
      if (!left.data?.length) await dbc.from('accounts').delete().eq('id', oldAcc); // empty leftover account
    } else {
      await dbc.from('channels').update({ channel_name: name }).eq('id', channelId);
    }
  } else {
    if (sessionAcc) accountId = sessionAcc;
    else {
      const acc = await dbc.from('accounts').insert({ display_name: name }).select('id').single();
      if (acc.error) throw new Error(acc.error.message);
      accountId = acc.data.id as string;
    }
    const ch = await dbc.from('channels').insert({ account_id: accountId, platform, platform_user_id: platformUserId, channel_name: name }).select('id').single();
    if (ch.error) throw new Error(ch.error.message);
    channelId = ch.data.id as string;
    await dbc.from('settings').insert({ channel_id: channelId });
  }
  return { channelId: channelId!, accountId: accountId! };
}
