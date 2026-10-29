import { db } from './supabase';
import { dropSettingsCache } from './translator';

// Admin = a Kick user id listed in ADMIN_KICK_USER_IDS (comma separated). Nobody else sees /admin.
export const isAdmin = (ch: { platform_user_id: string } | null) =>
  Boolean(ch && String(process.env.ADMIN_KICK_USER_IDS || '').split(',').map(x => x.trim()).filter(Boolean).includes(ch.platform_user_id));

// Forgets the saved tokens and turns the translator off. The row stays so signing in again is quick.
export async function disconnectChannel(channelId: string) {
  await db().from('channels').update({ access_token_enc: null, refresh_token_enc: null, token_expires_at: null }).eq('id', channelId);
  await db().from('settings').update({ enabled: false }).eq('channel_id', channelId);
  dropSettingsCache(channelId);
}
