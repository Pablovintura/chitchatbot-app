import { cleanForDetect, detectLanguage, flagFor, looksEnglish } from './detect';
import { db } from './supabase';
import { sendChat as kickSend } from './kick';
import { sendChat as twitchSend } from './twitch';

// Chat translator for a connected Kick or Twitch channel: other languages -> English line in chat via Cloudflare Workers AI.
// Same behaviour as PxVbot's translator. Messages are never stored or logged; only a character count is added to usage.

const PER_MINUTE = 6;
const MAX_CHAT = 500;
const MODEL = '@cf/meta/m2m100-1.2b';
export const FREE_CAP = 50000;                       // characters per channel per month on the free plan
const DAILY_MAX = Number(process.env.DAILY_TRANSLATIONS) || 8000; // safety stop for the shared Cloudflare allowance (resets each UTC day)
// Every language the bot can translate into (the same ones it can recognise in chat).
export const LANGUAGES: Record<string, string> = { en: 'English', es: 'Spanish', pt: 'Portuguese', fr: 'French', de: 'German', it: 'Italian', nl: 'Dutch', pl: 'Polish', tr: 'Turkish', id: 'Indonesian', ms: 'Malay', vi: 'Vietnamese', tl: 'Filipino', sv: 'Swedish', ro: 'Romanian', ru: 'Russian', uk: 'Ukrainian', ar: 'Arabic', hi: 'Hindi', zh: 'Chinese', ja: 'Japanese', ko: 'Korean', th: 'Thai' };

type Settings = { enabled: boolean; cooldown: number; home: string; mods: boolean; skip: Set<string>; style: 'colon' | 'lang'; flag: boolean; orig: boolean; at: number };
// Name of the language a chat message was in, written in the streamer's own language ("Spanisch" for a German streamer). Falls back to English.
const nameCache = new Map<string, Intl.DisplayNames | null>();
function langLabel(code: string, home: string): string {
  let dn = nameCache.get(home);
  if (dn === undefined) { try { dn = new Intl.DisplayNames([home], { type: 'language' }); } catch { dn = null; } nameCache.set(home, dn); }
  let out = '';
  try { out = (dn && dn.of(code)) || ''; } catch { /* unknown code */ }
  return out && out.toLowerCase() !== code.toLowerCase() ? out : LANGUAGES[code] || code;
}
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
type Chan = { id: string; account_id: string; platform: string; platform_user_id: string };
const chanCache = new Map<string, (Chan & { at: number }) | { id: null; at: number }>();
async function channelFor(platform: string, broadcasterId: string): Promise<Chan | null> {
  const key = `${platform}:${broadcasterId}`;
  const hit = chanCache.get(key);
  if (hit && Date.now() - hit.at < 60000) return hit.id ? (hit as Chan) : null;
  const { data } = await db().from('channels').select('id, account_id').eq('platform', platform).eq('platform_user_id', broadcasterId).maybeSingle();
  if (chanCache.size > 2000) chanCache.clear();
  const ch: Chan | null = data ? { id: data.id as string, account_id: data.account_id as string, platform, platform_user_id: broadcasterId } : null;
  chanCache.set(key, ch ? { ...ch, at: Date.now() } : { id: null, at: Date.now() });
  return ch;
}

// One place that knows how to talk in each platform's chat.
const say = (ch: Chan, text: string) => (ch.platform === 'twitch' ? twitchSend(ch.platform_user_id, text) : kickSend(ch.id, text));

export function dropSettingsCache(channelId: string) { cache.delete(channelId); }

async function settingsFor(channelId: string): Promise<Settings> {
  const hit = cache.get(channelId);
  if (hit && Date.now() - hit.at < 30000) return hit;
  // Every column, so one missing column can't make the whole read fail (and switch the translator off).
  const { data } = await db().from('settings').select('*').eq('channel_id', channelId).maybeSingle();
  const home = String(data?.home_language || 'en');
  const s = { enabled: Boolean(data?.enabled), cooldown: Number(data?.cooldown_seconds ?? 30), home: LANGUAGES[home] ? home : 'en', mods: Boolean(data?.mods_can_toggle), skip: new Set<string>((Array.isArray(data?.skip_list) ? data.skip_list : []).map((x: string) => skipKey(String(x)))), style: data?.reply_style === 'lang' ? 'lang' as const : 'colon' as const, flag: data?.reply_flag !== false, orig: data?.reply_original === true, at: Date.now() };
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

export type ChatEvent = { platform?: 'kick' | 'twitch'; messageId: string | null; broadcasterId: string; senderId: string; username: string; text: string; isMod?: boolean };

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
    if (!msg || OWN_LINE.test(msg)) return; // our own lines
    if (ev.platform !== 'twitch' && process.env.KICK_BOT_USER_ID && ev.senderId === process.env.KICK_BOT_USER_ID) return;

    const ch = await channelFor(ev.platform || 'kick', ev.broadcasterId);
    if (!ch) return;
    const channelId = ch.id;

    // !translate on / off: same switch as the dashboard. "all" does both of your channels (Kick and Twitch) at once.
    // Broadcaster only, others are ignored quietly.
    const sw = msg.match(/^!translate\s+(on|off)(\s+all)?\s*$/i);
    if (sw) {
      const allowed = ev.senderId === ev.broadcasterId || (ev.isMod && (await settingsFor(channelId)).mods);
      if (!allowed) return;
      const enabled = sw[1].toLowerCase() === 'on';
      if (enabled && !configured()) { await say(ch, "Translate can't turn on yet: the translation key is missing. Not our finest moment."); return; }
      let targets: Chan[] = [ch];
      if (sw[2]) {
        const { data } = await db().from('channels').select('id, account_id, platform, platform_user_id, access_token_enc').eq('account_id', ch.account_id);
        targets = ((data || []) as any[]).filter(r => r.id === channelId || r.access_token_enc).map(r => ({ id: r.id as string, account_id: r.account_id as string, platform: r.platform as string, platform_user_id: String(r.platform_user_id) }));
      }
      const from = ch.platform === 'twitch' ? 'Twitch chat' : 'Kick chat';
      for (const t of targets) {
        const { error } = await db().from('settings').upsert({ channel_id: t.id, enabled, updated_at: new Date().toISOString() }, { onConflict: 'channel_id' });
        if (error) { if (t.id === channelId) await say(ch, "Couldn't change the translate setting. Try again in a sec."); continue; }
        dropSettingsCache(t.id);
        await db().from('settings').update({ toggled_by: from, toggled_at: new Date().toISOString() }).eq('channel_id', t.id).then(() => {}, () => {}); // note for the dashboard; fine if the columns aren't there yet
        await say(t, enabled ? `Translate is ON. Anything not in ${LANGUAGES[(await settingsFor(t.id)).home]} gets a translated line. No more nodding along.` : 'Translate is OFF. Chat is on its own. Good luck.').catch(() => {});
      }
      return;
    }
    if (msg.startsWith('!')) return; // other commands
    const s = await settingsFor(channelId);
    if (!s.enabled) return;
    if (s.skip.has(skipKey(ev.username))) return; // on the streamer's skip list

    const now = Date.now();
    const ukey = `${channelId}:${ev.senderId}`;
    const last = lastByUser.get(ukey);
    if (last && now - last < s.cooldown * 1000) return;
    const times = (recent.get(channelId) || []).filter(t => now - t < 60000);
    if (times.length >= PER_MINUTE || (busy.get(channelId) || 0) >= 3) return;

    if (!underDailyMax()) return;
    if ((await usedThisMonth(ch.account_id)) >= FREE_CAP) return; // free plan used up: quiet until next month

    let source = detectLanguage(msg);
    if (!source && s.home !== 'en' && looksEnglish(msg)) source = 'en';
    if (!source || source === s.home) return;
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
      if (!english || plain(english) === plain(body)) return;
      // Mostly the same words in and out = it was English after all (he's famous -> He is famous).
      const wordsOf = (x: string) => x.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
      const outWords = new Set(wordsOf(english));
      const inWords = wordsOf(body);
      if (inWords.length && inWords.filter(w => outWords.has(w)).length / inWords.length >= 0.6) return;
      const who = ev.username.replace(/^@+/, '') + (s.style === 'lang' ? ` (${langLabel(source, s.home)})` : '');
      let line = `${s.flag ? flagFor(source) + ' ' : ''}${who}: ${english}${s.orig ? ` [${body}]` : ''}`;
      if (line.length > MAX_CHAT) line = line.slice(0, MAX_CHAT - 1) + '…';
      await say(ch, line);
      await countUsage(ch.account_id, body.length).catch(() => {});
    } finally {
      busy.set(channelId, Math.max(0, (busy.get(channelId) || 1) - 1));
    }
  } catch (e) {
    console.error('Chat translation failed:', (e as Error).message);
  }
}
