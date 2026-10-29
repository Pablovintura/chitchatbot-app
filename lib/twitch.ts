import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

// Twitch link for ChitChatBot. Same idea as Kick, but with a separate bot account doing the talking:
//  - the bot account (TWITCH_BOT_LOGIN) says yes once to "user:bot"
//  - each streamer says yes once to "channel:bot" (that is the whole sign-in)
//  - after that everything runs on the app's own token: chat comes in through EventSub webhooks, lines go out through
//    "Send Chat Message". No user tokens are saved anywhere.

const TIMEOUT = 10000;
export const STREAMER_SCOPES = 'channel:bot';
export const BOT_SCOPES = 'user:bot user:write:chat user:read:chat';

export const twitchReady = () => Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET && process.env.TWITCH_BOT_LOGIN);
export const appUrl = () => (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
export const redirectUri = () => process.env.TWITCH_REDIRECT_URI || `${appUrl()}/api/twitch/callback`;

// ---- sign-in (state in a short signed cookie, set by the login route) ----
export function newLogin(kind: 'streamer' | 'bot') {
  const state = randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID || '',
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: kind === 'bot' ? BOT_SCOPES : STREAMER_SCOPES,
    state,
    force_verify: 'true'
  });
  return { state, url: `https://id.twitch.tv/oauth2/authorize?${params}` };
}

async function tokenRequest(body: Record<string, string>): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.TWITCH_CLIENT_ID || '', client_secret: process.env.TWITCH_CLIENT_SECRET || '', ...body }),
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) throw new Error(`Twitch token request failed (${res.status})`);
  return data;
}

export const exchangeCode = (code: string) => tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() });

// Called right after sign-in with the fresh token (thrown away afterwards).
export async function whoAmI(userToken: string): Promise<{ id: string; name: string }> {
  const res = await fetch('https://api.twitch.tv/helix/users', {
    headers: { Authorization: `Bearer ${userToken}`, 'Client-Id': process.env.TWITCH_CLIENT_ID || '' },
    cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT)
  });
  const body = await res.json().catch(() => null);
  const u = body?.data?.[0];
  if (!res.ok || !u?.id) throw new Error('Could not read the Twitch profile.');
  return { id: String(u.id), name: String(u.display_name || u.login || 'twitch user') };
}

// ---- the app's own token (client credentials), kept until shortly before it ends ----
let app: { token: string; until: number } | null = null;
async function appToken(): Promise<string> {
  if (app && app.until - 60000 > Date.now()) return app.token;
  const t = await tokenRequest({ grant_type: 'client_credentials' });
  app = { token: t.access_token, until: Date.now() + Number(t.expires_in || 0) * 1000 };
  return app.token;
}

async function helix(path: string, init: RequestInit = {}, retry = true): Promise<{ status: number; body: any }> {
  const res = await fetch(`https://api.twitch.tv/helix${path}`, {
    ...init,
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT),
    headers: { Authorization: `Bearer ${await appToken()}`, 'Client-Id': process.env.TWITCH_CLIENT_ID || '', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers }
  });
  if (res.status === 401 && retry) { app = null; return helix(path, init, false); } // token was revoked or expired early
  const text = await res.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { responseText: text }; }
  return { status: res.status, body };
}

// The bot account's id, looked up once from its login name.
let botIdCache: string | null = null;
export async function botId(): Promise<string> {
  if (botIdCache) return botIdCache;
  const login = String(process.env.TWITCH_BOT_LOGIN || '').trim().toLowerCase().replace(/^@/, '');
  if (!login) throw new Error('TWITCH_BOT_LOGIN is not set.');
  const r = await helix(`/users?login=${encodeURIComponent(login)}`);
  const id = r.body?.data?.[0]?.id;
  if (r.status !== 200 || !id) throw new Error(`Twitch bot account "${login}" was not found.`);
  return (botIdCache = String(id));
}

// ---- chat feed (EventSub over webhook) ----
// The webhook secret is made from SESSION_SECRET, so there is nothing extra to set.
const evSecret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('Set SESSION_SECRET (32+ characters).');
  return createHmac('sha256', s).update('twitch-eventsub').digest('hex').slice(0, 48);
};

async function listChatSubs(broadcasterId: string): Promise<any[]> {
  const out: any[] = [];
  let after = '';
  for (let page = 0; page < 20; page++) {
    const r = await helix(`/eventsub/subscriptions?type=channel.chat.message${after ? `&after=${encodeURIComponent(after)}` : ''}`);
    if (r.status !== 200) break;
    for (const s of r.body?.data || []) if (String(s?.condition?.broadcaster_user_id) === String(broadcasterId)) out.push(s);
    after = r.body?.pagination?.cursor || '';
    if (!after) break;
  }
  return out;
}

export async function subscribeChat(broadcasterId: string) {
  const mine = await listChatSubs(broadcasterId);
  const good = mine.find(s => ['enabled', 'webhook_callback_verification_pending'].includes(String(s.status)));
  if (good) return 'exists';
  for (const s of mine) await helix(`/eventsub/subscriptions?id=${encodeURIComponent(s.id)}`, { method: 'DELETE' }); // failed or revoked ones
  const r = await helix('/eventsub/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      type: 'channel.chat.message', version: '1',
      condition: { broadcaster_user_id: String(broadcasterId), user_id: await botId() },
      transport: { method: 'webhook', callback: `${appUrl()}/api/twitch/webhook`, secret: evSecret() }
    })
  });
  if (r.status === 409) return 'exists';
  if (r.status !== 202 && r.status !== 200) throw new Error(`Twitch subscription failed (${r.status}): ${String(r.body?.message || '').slice(0, 160)}`);
  return 'subscribed';
}

// Stops Twitch from sending this channel's chat to us. Best effort.
export async function unsubscribeChat(broadcasterId: string) {
  for (const s of await listChatSubs(broadcasterId)) await helix(`/eventsub/subscriptions?id=${encodeURIComponent(s.id)}`, { method: 'DELETE' });
}

// ---- say something in a channel, as the bot account ----
export async function sendChat(broadcasterId: string, content: string) {
  const r = await helix('/chat/messages', {
    method: 'POST',
    body: JSON.stringify({ broadcaster_id: String(broadcasterId), sender_id: await botId(), message: content.slice(0, 500) })
  });
  const d = r.body?.data?.[0];
  if (r.status !== 200) throw new Error(`Twitch chat send returned HTTP ${r.status}: ${String(r.body?.message || '').slice(0, 160)}`);
  if (d && d.is_sent === false) throw new Error(`Twitch did not post the line (${d.drop_reason?.code || 'dropped'}).`);
}

// ---- webhook signature ----
export function verifyWebhook(headers: Headers, raw: Buffer): boolean {
  const id = headers.get('twitch-eventsub-message-id');
  const ts = headers.get('twitch-eventsub-message-timestamp');
  const sig = headers.get('twitch-eventsub-message-signature');
  if (!id || !ts || !sig) return false;
  const ms = Date.parse(ts);
  if (!Number.isFinite(ms) || Math.abs(Date.now() - ms) > 10 * 60 * 1000) return false;
  const want = Buffer.from('sha256=' + createHmac('sha256', evSecret()).update(Buffer.concat([Buffer.from(id + ts), raw])).digest('hex'));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}
