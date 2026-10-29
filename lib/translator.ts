import { cleanForDetect, detectLanguage, flagFor, looksEnglish } from './detect';
import { db } from './supabase';
import { sendChat } from './kick';

// Chat translator for a connected Kick channel: other languages -> English line in chat via Cloudflare Workers AI.
// Same behaviour as PxVbot's translator. Messages are never stored or logged; only a character count is added to usage.

const PER_MINUTE = 6;
const MAX_CHAT = 500;
const MODEL = '@cf/meta/m2m100-1.2b';
export const FREE_CAP = 50000;                       // characters per channel per month on the free plan
const DAILY_MAX = Number(process.env.DAILY_TRANSLATIONS) || 8000; // safety stop for the shared Cloudflare allowance (resets each UTC day)
export const LANGUAGES: Record<string, string> = { en: 'English', es: 'Spanish', pt: 'Portuguese', fr: 'French', ja: 'Japanese', ko: 'Korean' };

type Settings = { enabled: boolean; cooldown: number; home: string; mods: boolean; skip: Set<string>; at: number };
export const SKIP_MAX = 50;
export const skipKey = (n: string) => n.toLowerCase().replace(/^@+/, '').replace(/[-_\s]/g, ''); // Kick slugs use - where names use _
const cache = new Map<string, Settings>();           // channel id -> settings (30 s)
const lastByUser = new Map<string, number>();         // channel:user -> last translated
const recent = new Map<string, number[]>();           // channel -> times in the last minute
const busy = new Map<string, number>();
const seen = new Set<string>();
let dayKey = '', dayCount = 0;
const underDailyMax = () => { const d = new Date().toISOString().slice(0, 10); if (d !== dayKey) { dayKey = d; dayCount = 0; } return dayCount < DAILY_MAX; };
const usageCache = new Map<string, { month: string; chars: number; at: number }>();                       // webhook message ids already handled

// Forgiving about how the values were pasted: spaces, quotes or a leading "Bearer " are removed.
const tidy = (v?: string) => String(v || '').trim().replace(/^["']+|["']+$/g, '').replace(/^Bearer\s+/i, '').trim();
export const configured = () => Boolean(tidy(process.env.CF_ACCOUNT_ID) && tidy(process.env.CF_AI_TOKEN));

// Our own lines look like "🇪🇸 pedro: hello". Never translate those back.
const OWN_LINE = /^(?:\p{Regional_Indicator}{2}|🌐) [^\s:]+: /u;

// Every chat message of every linked channel arrives here, so the channel lookup is remembered for a minute
// instead of asking the database each time.
const chanCache = new Map<string, { id: string; account_id: string; at: number } | { id: null; at: number }>();
async function channelFor(broadcasterId: string): Promise<{ id: string; account_id: string } | null> {
  const hit = chanCache.get(broadcasterId);
  if (hit && Date.now() - hit.at < 60000) return hit.id ? (hit as { id: string; account_id: string }) : null;
  const { data } = await db().from('channels').select('id, account_id').eq('platform', 'kick').eq('platform_user_id', broadcasterId).maybeSingle();
  if (chanCache.size > 2000) chanCache.clear();
  chanCache.set(broadcasterId, data ? { id: data.id as string, account_id: data.account_id as string, at: Date.now() } : { id: null, at: Date.now() });
  return data ? { id: data.id as string, account_id: data.account_id as string } : null;
}

export function dropSettingsCache(channelId: string) { cache.delete(channelId); }

async function settingsFor(channelId: string): Promise<Settings> {
  const hit = cache.get(channelId);
  if (hit && Date.now() - hit.at < 30000) return hit;
  // Every column, so one missing column can't make the whole read fail (and switch the translator off).
  const { data } = await db().from('settings').select('*').eq('channel_id', channelId).maybeSingle();
  const home = String(data?.home_language || 'en');
  const s = { enabled: Boolean(data?.enabled), cooldown: Number(data?.cooldown_seconds ?? 30), home: LANGUAGES[home] ? home : 'en', mods: Boolean(data?.mods_can_toggle), skip: new Set<string>((Array.isArray(data?.skip_list) ? data.skip_list : []).map((x: string) => skipKey(String(x)))), at: Date.now() };
  cache.set(channelId, s);
  return s;
}

// The free Cloudflare model can be slow to wake up, so wait longer and try a second time before giving up.
async function translate(text: string, source: string, target: string): Promise<string> {
  try { return await translateOnce(text, source, target); }
  catch (e) {
    const msg = (e as Error).message || '';
    if (!/timeout|abort|Cloudflare 5\d\d/i.test(msg)) throw e;
    return translateOnce(text, source, target);
  }
}

async function translateOnce(text: string, source: string, target: string): Promise<string> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(tidy(process.env.CF_ACCOUNT_ID))}/ai/run/${MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tidy(process.env.CF_AI_TOKEN)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, source_lang: source, target_lang: target }),
    signal: AbortSignal.timeout(20000)
  });
  const body: any = await res.json().catch(() => null);
  const out = body?.result?.translated_text;
  if (!res.ok || typeof out !== 'string') {
    const why = (body?.errors || []).map((e: any) => `${e.code || ''} ${e.message || ''}`.trim()).filter(Boolean).join('; ');
    throw new Error(`Cloudflare ${res.status}${why ? ` (${why.slice(0, 200)})` : ''}`);
  }
  return out.trim();
}

const monthStart = () => new Date().toISOString().slice(0, 8) + '01';

// Characters used this month. Remembered for 30 s and bumped locally so a busy chat does not hit the database every line.
export async function usedThisMonth(accountId: string): Promise<number> {
  const month = monthStart();
  const hit = usageCache.get(accountId);
  if (hit && hit.month === month && Date.now() - hit.at < 30000) return hit.chars;
  const { data } = await db().from('usage').select('characters').eq('account_id', accountId).eq('month', month).maybeSingle();
  const chars = Number(data?.characters || 0);
  if (usageCache.size > 2000) usageCache.clear();
  usageCache.set(accountId, { month, chars, at: Date.now() });
  return chars;
}

async function countUsage(accountId: string, chars: number) {
  const month = monthStart();
  const before = await usedThisMonth(accountId);
  const chars2 = before + chars;
  usageCache.set(accountId, { month, chars: chars2, at: Date.now() });
  await db().from('usage').upsert({ account_id: accountId, month, characters: chars2 }, { onConflict: 'account_id,month' });
}

export type ChatEvent = { messageId: string | null; broadcasterId: string; senderId: string; username: string; text: string; isMod?: boolean };

// Runs after the webhook has already been answered. Never throws.
// TEMP diagnostic: one line per message saying where it stopped. Never logs the message text. Remove once fixed.
const why = (r: string) => console.log(`[cc-diag] ${r}`);
export async function onChat(ev: ChatEvent) {
  try {
    why('got chat event');
    if (!configured()) return why('skip: not configured');
    if (ev.messageId) {
      if (seen.has(ev.messageId)) return;
      seen.add(ev.messageId);
      if (seen.size > 5000) seen.delete(seen.values().next().value as string);
    }
    const msg = ev.text.trim();
    if (!msg || OWN_LINE.test(msg)) return; // our own lines
    if (process.env.KICK_BOT_USER_ID && ev.senderId === process.env.KICK_BOT_USER_ID) return;

    const ch = await channelFor(ev.broadcasterId);
    if (!ch) return why('skip: channel not linked');
    const channelId = ch.id;

    // !translate on / off: same switch as the dashboard. Broadcaster only, others are ignored quietly.
    const sw = msg.match(/^!translate\s+(on|off)\s*$/i);
    if (sw) {
      const allowed = ev.senderId === ev.broadcasterId || (ev.isMod && (await settingsFor(channelId)).mods);
      if (!allowed) return;
      const enabled = sw[1].toLowerCase() === 'on';
      if (enabled && !configured()) { await sendChat(channelId, "Translate can't turn on yet: the translation key is missing. Not our finest moment."); return; }
      const { error } = await db().from('settings').upsert({ channel_id: channelId, enabled, updated_at: new Date().toISOString() }, { onConflict: 'channel_id' });
      if (error) { await sendChat(channelId, "Couldn't change the translate setting. Try again in a sec."); return; }
      dropSettingsCache(channelId);
      await sendChat(channelId, enabled ? `Translate is ON. Anything not in ${LANGUAGES[(await settingsFor(channelId)).home]} gets a translated line. No more nodding along.` : 'Translate is OFF. Chat is on its own. Good luck.');
      return;
    }
    if (msg.startsWith('!')) return; // other commands
    const s = await settingsFor(channelId);
    if (!s.enabled) return why('skip: translate off');
    if (s.skip.has(skipKey(ev.username))) return why('skip: skip list'); // on the streamer's skip list

    const now = Date.now();
    const ukey = `${channelId}:${ev.senderId}`;
    const last = lastByUser.get(ukey);
    if (last && now - last < s.cooldown * 1000) return why('skip: cooldown');
    const times = (recent.get(channelId) || []).filter(t => now - t < 60000);
    if (times.length >= PER_MINUTE || (busy.get(channelId) || 0) >= 3) return why('skip: rate limit');

    if (!underDailyMax()) return why('skip: daily max');
    if ((await usedThisMonth(ch.account_id)) >= FREE_CAP) return why('skip: monthly cap'); // free plan used up: quiet until next month

    let source = detectLanguage(msg);
    if (!source && s.home !== 'en' && looksEnglish(msg)) source = 'en';
    if (!source || source === s.home) return why(`skip: language ${source || 'unsure/english'}`);
    const body = cleanForDetect(msg).slice(0, 400);

    lastByUser.set(ukey, now);
    if (lastByUser.size > 5000) lastByUser.clear();
    times.push(now);
    recent.set(channelId, times);
    busy.set(channelId, (busy.get(channelId) || 0) + 1);
    try {
      dayCount++;
      const english = await translate(body, source, s.home);
      const plain = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
      if (!english || plain(english) === plain(body)) return why(`skip: cloudflare returned ${english ? 'the same text' : 'nothing'}`);
      // Mostly the same words in and out = it was English after all (he's famous -> He is famous).
      const wordsOf = (x: string) => x.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
      const outWords = new Set(wordsOf(english));
      const inWords = wordsOf(body);
      if (inWords.length && inWords.filter(w => outWords.has(w)).length / inWords.length >= 0.6) return why('skip: output mostly same words');
      let line = `${flagFor(source)} ${ev.username.replace(/^@+/, '')}: ${english}`;
      if (line.length > MAX_CHAT) line = line.slice(0, MAX_CHAT - 1) + '…';
      await sendChat(channelId, line);
      why(`posted ${source}>${s.home}`);
      await countUsage(ch.account_id, body.length).catch(() => {});
    } finally {
      busy.set(channelId, Math.max(0, (busy.get(channelId) || 1) - 1));
    }
  } catch (e) {
    console.error('Chat translation failed:', (e as Error).message);
  }
}
