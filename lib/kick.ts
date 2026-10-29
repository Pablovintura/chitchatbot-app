import { createHash, randomBytes, verify } from 'crypto';
import { db } from './supabase';
import { decrypt, encrypt } from './crypto';

// Same linking flow PxVbot uses: OAuth 2.1 with PKCE, signed webhooks, chat.message.sent subscription.
// Everything here is ChitChatBot's own (its own Kick app, its own database). Nothing touches PxVbot.

const TIMEOUT = 10000;
export const SCOPES = 'user:read chat:write events:subscribe channel:read';

export const appUrl = () => (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
export const redirectUri = () => process.env.KICK_REDIRECT_URI || `${appUrl()}/api/kick/callback`;

// ---- login (PKCE) ----
// State and verifier live in a short-lived signed cookie, so no server memory is needed.
export function newLogin() {
  const state = randomBytes(16).toString('hex');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const params = new URLSearchParams({
    client_id: process.env.KICK_CLIENT_ID || '',
    response_type: 'code',
    redirect_uri: redirectUri(),
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });
  return { state, verifier, url: `https://id.kick.com/oauth/authorize?${params}` };
}

type Tokens = { access_token: string; refresh_token: string; expires_in: number; scope?: string };

async function tokenRequest(body: Record<string, string>): Promise<Tokens> {
  const res = await fetch('https://id.kick.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.KICK_CLIENT_ID || '', client_secret: process.env.KICK_CLIENT_SECRET || '', ...body }),
    signal: AbortSignal.timeout(TIMEOUT)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token || !data?.refresh_token) throw new Error(`Kick token request failed (${res.status})`);
  return data;
}

export const exchangeCode = (code: string, verifier: string) =>
  tokenRequest({ grant_type: 'authorization_code', redirect_uri: redirectUri(), code_verifier: verifier, code });

// ---- API with a channel's saved tokens (refreshes when needed) ----
const refreshing = new Map<string, Promise<string>>();

export async function saveTokens(channelId: string, t: Tokens) {
  const { error } = await db().from('channels').update({
    access_token_enc: encrypt(t.access_token),
    refresh_token_enc: encrypt(t.refresh_token),
    token_expires_at: new Date(Date.now() + Number(t.expires_in || 0) * 1000).toISOString()
  }).eq('id', channelId);
  if (error) throw new Error(`Could not save Kick tokens: ${error.message}`);
}

async function accessToken(channelId: string): Promise<string> {
  const { data, error } = await db().from('channels')
    .select('access_token_enc, refresh_token_enc, token_expires_at').eq('id', channelId).maybeSingle();
  if (error || !data?.access_token_enc || !data.refresh_token_enc) throw new Error('Kick is not connected.');
  if (Date.parse(data.token_expires_at as string) - 60000 > Date.now()) return decrypt(data.access_token_enc as string);

  const running = refreshing.get(channelId);
  if (running) return running;
  const job = (async () => {
    const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: decrypt(data.refresh_token_enc as string) });
    await saveTokens(channelId, t); // Kick gives a new pair every refresh, so it must be saved
    return t.access_token;
  })().finally(() => refreshing.delete(channelId));
  refreshing.set(channelId, job);
  return job;
}

export async function kickApi(channelId: string, path: string, init: RequestInit = {}) {
  const token = await accessToken(channelId);
  const res = await fetch(`https://api.kick.com${path}`, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT),
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers }
  });
  const text = await res.text();
  let out: any = {};
  try { out = text ? JSON.parse(text) : {}; } catch { out = { responseText: text }; }
  if (!res.ok) throw new Error(`Kick API ${path} returned HTTP ${res.status}`);
  return out;
}

// Called right after sign-in, with the fresh token (nothing saved yet).
export async function whoAmI(accessToken: string): Promise<{ id: string; name: string }> {
  const res = await fetch('https://api.kick.com/public/v1/users', { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(TIMEOUT) });
  const body = await res.json().catch(() => null);
  const u = body?.data?.[0];
  if (!res.ok || !u?.user_id) throw new Error('Could not read the Kick profile.');
  return { id: String(u.user_id), name: String(u.name || u.username || 'kick user') };
}

export async function subscribeChat(channelId: string, broadcasterId: string) {
  const existing = await kickApi(channelId, `/public/v1/events/subscriptions?broadcaster_user_id=${broadcasterId}`).catch(() => ({ data: [] }));
  const list: any[] = Array.isArray(existing.data) ? existing.data : [];
  if (list.some(s => s.event === 'chat.message.sent' || s.name === 'chat.message.sent')) return 'exists';
  await kickApi(channelId, '/public/v1/events/subscriptions', {
    method: 'POST',
    body: JSON.stringify({ broadcaster_user_id: Number(broadcasterId), method: 'webhook', events: [{ name: 'chat.message.sent', version: 1 }] })
  });
  return 'subscribed';
}

// Stops Kick from sending this channel's chat to us. Best effort: must run while the token is still saved.
export async function unsubscribeChat(channelId: string, broadcasterId: string) {
  const existing = await kickApi(channelId, `/public/v1/events/subscriptions?broadcaster_user_id=${broadcasterId}`);
  const ids = (Array.isArray(existing.data) ? existing.data : []).map((s: any) => s.id).filter(Boolean);
  if (!ids.length) return;
  await kickApi(channelId, `/public/v1/events/subscriptions?${ids.map((id: string) => `id=${encodeURIComponent(id)}`).join('&')}`, { method: 'DELETE' });
}

// Kick only makes links clickable with https:// in front.
const withHttps = (t: string) =>
  t.replace(/(^|[^\w./:@-])((?:www\.)?(?:chitchatbot\.stream|kick\.com)(?:\/[^\s]*)?)(?=\s|$)/gi, '$1https://$2');

export const sendChat = (channelId: string, content: string) =>
  kickApi(channelId, '/public/v1/chat', { method: 'POST', body: JSON.stringify({ content: withHttps(content).slice(0, 500), type: 'bot' }) });

// ---- webhook signature ----
let publicKey: string | null = null;
async function getPublicKey() {
  if (publicKey) return publicKey;
  const res = await fetch('https://api.kick.com/public/v1/public-key', { signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error('Could not fetch the Kick public key.');
  const r: any = await res.json();
  const key = r.public_key || r.data?.public_key || (typeof r.data === 'string' ? r.data : null);
  if (typeof key !== 'string' || !key.includes('PUBLIC KEY')) throw new Error('Unexpected Kick public-key response.');
  return (publicKey = key);
}

export async function verifyWebhook(headers: Headers, raw: Buffer): Promise<boolean> {
  const id = headers.get('kick-event-message-id');
  const ts = headers.get('kick-event-message-timestamp');
  const sig = headers.get('kick-event-signature');
  if (!id || !ts || !sig) return false;
  const ms = Date.parse(ts);
  if (!Number.isFinite(ms) || Math.abs(Date.now() - ms) > 5 * 60 * 1000) return false;
  return verify('RSA-SHA256', Buffer.concat([Buffer.from(`${id}.${ts}.`), raw]), await getPublicKey(), Buffer.from(sig, 'base64'));
}
