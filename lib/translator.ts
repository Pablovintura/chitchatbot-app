import { cleanForDetect, detectLanguage } from './detect';
import { db } from './supabase';
import { sendChat } from './kick';

// Chat translator for a connected Kick channel: other languages -> English line in chat via Cloudflare Workers AI.
// Same behaviour as PxVbot's translator. Messages are never stored or logged; only a character count is added to usage.

const PER_MINUTE = 6;
const MAX_CHAT = 500;
const MODEL = '@cf/meta/m2m100-1.2b';

type Settings = { enabled: boolean; cooldown: number; at: number };
const cache = new Map<string, Settings>();           // channel id -> settings (30 s)
const lastByUser = new Map<string, number>();         // channel:user -> last translated
const recent = new Map<string, number[]>();           // channel -> times in the last minute
const busy = new Map<string, number>();
const seen = new Set<string>();                       // webhook message ids already handled

export const configured = () => Boolean(process.env.CF_ACCOUNT_ID?.trim() && process.env.CF_AI_TOKEN?.trim());

export function dropSettingsCache(channelId: string) { cache.delete(channelId); }

async function settingsFor(channelId: string): Promise<Settings> {
  const hit = cache.get(channelId);
  if (hit && Date.now() - hit.at < 30000) return hit;
  const { data } = await db().from('settings').select('enabled, cooldown_seconds').eq('channel_id', channelId).maybeSingle();
  const s = { enabled: Boolean(data?.enabled), cooldown: Number(data?.cooldown_seconds ?? 30), at: Date.now() };
  cache.set(channelId, s);
  return s;
}

async function translate(text: string, source: string): Promise<string> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(process.env.CF_ACCOUNT_ID!.trim())}/ai/run/${MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CF_AI_TOKEN!.trim()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, source_lang: source, target_lang: 'en' }),
    signal: AbortSignal.timeout(8000)
  });
  const body: any = await res.json().catch(() => null);
  const out = body?.result?.translated_text;
  if (!res.ok || typeof out !== 'string') throw new Error(`Cloudflare ${res.status}`);
  return out.trim();
}

async function countUsage(accountId: string, chars: number) {
  const month = new Date().toISOString().slice(0, 8) + '01';
  const { data } = await db().from('usage').select('characters').eq('account_id', accountId).eq('month', month).maybeSingle();
  await db().from('usage').upsert({ account_id: accountId, month, characters: Number(data?.characters || 0) + chars }, { onConflict: 'account_id,month' });
}

export type ChatEvent = { messageId: string | null; broadcasterId: string; senderId: string; username: string; text: string };

// Runs after the webhook has already been answered. Never throws.
export async function onChat(ev: ChatEvent) {
  try {
    if (!configured()) return;
    if (ev.messageId) {
      if (seen.has(ev.messageId)) return;
      seen.add(ev.messageId);
      if (seen.size > 5000) seen.delete(seen.values().next().value as string);
    }
    const msg = ev.text.trim();
    if (!msg || msg.startsWith('!') || msg.startsWith('🌐')) return; // commands, and our own lines

    const { data: ch } = await db().from('channels').select('id, account_id').eq('platform', 'kick').eq('platform_user_id', ev.broadcasterId).maybeSingle();
    if (!ch) return;
    const channelId = ch.id as string;
    const s = await settingsFor(channelId);
    if (!s.enabled) return;

    const now = Date.now();
    const ukey = `${channelId}:${ev.senderId}`;
    const last = lastByUser.get(ukey);
    if (last && now - last < s.cooldown * 1000) return;
    const times = (recent.get(channelId) || []).filter(t => now - t < 60000);
    if (times.length >= PER_MINUTE || (busy.get(channelId) || 0) >= 3) return;

    const source = detectLanguage(msg);
    if (!source) return;
    const body = cleanForDetect(msg).slice(0, 400);

    lastByUser.set(ukey, now);
    if (lastByUser.size > 5000) lastByUser.clear();
    times.push(now);
    recent.set(channelId, times);
    busy.set(channelId, (busy.get(channelId) || 0) + 1);
    try {
      const english = await translate(body, source);
      const plain = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
      if (!english || plain(english) === plain(body)) return;
      let line = `🌐 ${ev.username.replace(/^@+/, '')}: ${english}`;
      if (line.length > MAX_CHAT) line = line.slice(0, MAX_CHAT - 1) + '…';
      await sendChat(channelId, line);
      await countUsage(ch.account_id as string, body.length).catch(() => {});
    } finally {
      busy.set(channelId, Math.max(0, (busy.get(channelId) || 1) - 1));
    }
  } catch (e) {
    console.error('Chat translation failed:', (e as Error).message);
  }
}
