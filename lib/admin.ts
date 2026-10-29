import { db } from './supabase';
import { dropSettingsCache } from './translator';
import { unsubscribeChat } from './kick';

// Admin = a Kick user id listed in ADMIN_KICK_USER_IDS (comma separated). Nobody else sees /admin.
export const isAdmin = (ch: { platform_user_id: string } | null) =>
  Boolean(ch && String(process.env.ADMIN_KICK_USER_IDS || '').split(',').map(x => x.trim()).filter(Boolean).includes(ch.platform_user_id));

// Stops Kick's chat feed, forgets the saved tokens and turns the translator off. The row stays so signing in again is quick.
export async function disconnectChannel(channelId: string) {
  try {
    const { data } = await db().from('channels').select('platform_user_id').eq('id', channelId).maybeSingle();
    if (data?.platform_user_id) await unsubscribeChat(channelId, String(data.platform_user_id));
  } catch { /* token may be expired or already gone: disconnect anyway */ }
  await db().from('channels').update({ access_token_enc: null, refresh_token_enc: null, token_expires_at: null }).eq('id', channelId);
  await db().from('settings').update({ enabled: false }).eq('channel_id', channelId);
  dropSettingsCache(channelId);
}
