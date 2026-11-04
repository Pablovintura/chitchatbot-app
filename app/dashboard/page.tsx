'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

type Status = {
  connected: boolean; platform?: 'kick' | 'twitch'; channels?: { platform: 'kick' | 'twitch'; name: string; enabled?: boolean; by?: string; at?: string }[]; kickReady?: boolean; twitchReady?: boolean; translatorReady?: boolean; channel?: string; admin?: boolean;
  enabled?: boolean; by?: string; at?: string; cooldown?: number; language?: string; ignoredLanguages?: string[]; mods?: boolean; used?: number; cap?: number; skip?: string[]; replyStyle?: 'colon' | 'lang'; replyFlag?: boolean; replyOriginal?: boolean;
};

const LANGS: Record<string, string> = { en: 'English', es: 'Spanish', pt: 'Portuguese', fr: 'French', de: 'German', it: 'Italian', nl: 'Dutch', pl: 'Polish', tr: 'Turkish', id: 'Indonesian', ms: 'Malay', vi: 'Vietnamese', tl: 'Filipino', sv: 'Swedish', ro: 'Romanian', ru: 'Russian', uk: 'Ukrainian', ar: 'Arabic', hi: 'Hindi', zh: 'Chinese', ja: 'Japanese', ko: 'Korean', th: 'Thai' };
const PAUSES: [number, string][] = [[0, 'None'], [10, '10 sec'], [30, '30 sec'], [60, '1 min'], [120, '2 min'], [300, '5 min']];
// Name of the example sender's language, written in the streamer's own language. Falls back to English.
const srcLabel = (code: string, home: string) => {
  try { const n = new Intl.DisplayNames([home], { type: 'language' }).of(code); if (n && n.toLowerCase() !== code) return n; } catch { /* old browser */ }
  return LANGS[code] || code;
};
const EX: Record<string, { flag: string; user: string; orig: string; tr: string }> = {
  en: { flag: '🇪🇸', user: 'pedro_mx', orig: 'jajaja que bueno estuvo el stream', tr: 'lol how good the stream was' },
  es: { flag: '🇺🇸', user: 'jake_nyc', orig: 'that last play was so clean', tr: 'esa última jugada estuvo muy limpia' },
  pt: { flag: '🇪🇸', user: 'pedro_mx', orig: 'jajaja que bueno estuvo el stream', tr: 'kkkk que legal foi a stream' },
  fr: { flag: '🇪🇸', user: 'pedro_mx', orig: 'jajaja que bueno estuvo el stream', tr: 'mdr trop bien le stream' },
  ja: { flag: '🇪🇸', user: 'pedro_mx', orig: 'jajaja que bueno estuvo el stream', tr: '笑 配信すごく良かった' },
  ko: { flag: '🇪🇸', user: 'pedro_mx', orig: 'jajaja que bueno estuvo el stream', tr: 'ㅋㅋㅋ 방송 진짜 좋았어' },
  de: { flag: '🇪🇸', user: 'pedro_mx', orig: 'jajaja que bueno estuvo el stream', tr: 'lol wie gut der Stream war' },
  it: { flag: '🇪🇸', user: 'pedro_mx', orig: 'jajaja que bueno estuvo el stream', tr: 'lol che bello lo stream' },
  nl: { flag: '🇪🇸', user: 'pedro_mx', orig: 'jajaja que bueno estuvo el stream', tr: 'lol wat was de stream goed' },
  pl: { flag: '🇪🇸', user: 'pedro_mx', orig: 'jajaja que bueno estuvo el stream', tr: 'lol jak świetny był ten stream' },
  tr: { flag: '🇪🇸', user: 'pedro_mx', orig: 'jajaja que bueno estuvo el stream', tr: 'lol yayın ne kadar iyiydi' },
  id: { flag: '🇪🇸', user: 'pedro_mx', orig: 'jajaja que bueno estuvo el stream', tr: 'wkwk streamnya seru banget' },
  ms: { flag: '🇪🇸', user: 'pedro_mx', orig: 'jajaja que bueno estuvo el stream', tr: 'lol bestnya stream ni' },
  vi: { flag: '🇪🇸', user: 'pedro_mx', orig: 'jajaja que bueno estuvo el stream', tr: 'haha stream hay quá' },
  tl: { flag: '🇪🇸', user: 'pedro_mx', orig: 'jajaja que bueno estuvo el stream', tr: 'haha ang saya ng stream' },
  sv: { flag: '🇪🇸', user: 'pedro_mx', orig: 'jajaja que bueno estuvo el stream', tr: 'lol vad bra streamen var' },
  ro: { flag: '🇪🇸', user: 'pedro_mx', orig: 'jajaja que bueno estuvo el stream', tr: 'lol ce bună a fost transmisiunea' },
  ru: { flag: '🇪🇸', user: 'pedro_mx', orig: 'jajaja que bueno estuvo el stream', tr: 'лол как же хорош был стрим' },
  uk: { flag: '🇪🇸', user: 'pedro_mx', orig: 'jajaja que bueno estuvo el stream', tr: 'лол який чудовий був стрім' },
  ar: { flag: '🇪🇸', user: 'pedro_mx', orig: 'jajaja que bueno estuvo el stream', tr: 'ههه كم كان البث رائعًا' },
  hi: { flag: '🇪🇸', user: 'pedro_mx', orig: 'jajaja que bueno estuvo el stream', tr: 'लोल स्ट्रीम कितनी मज़ेदार थी' },
  zh: { flag: '🇪🇸', user: 'pedro_mx', orig: 'jajaja que bueno estuvo el stream', tr: '哈哈 这场直播太棒了' },
  th: { flag: '🇪🇸', user: 'pedro_mx', orig: 'jajaja que bueno estuvo el stream', tr: 'ฮ่าๆ สตรีมสนุกมาก' }
};
const NOTES: Record<string, string> = { connected: 'Kick connected.', denied: 'Kick sign-in was cancelled.', expired: 'That sign-in expired. Try again.', error: 'Could not finish connecting Kick.' };
const TNOTES: Record<string, string> = { connected: 'Twitch connected.', denied: 'Twitch sign-in was cancelled.', expired: 'That sign-in expired. Try again.', error: 'Could not finish connecting Twitch.', botok: 'The bot account is set. Now streamers can connect.' };

export default function Dashboard() {
  const viewRef = useRef('');
  const [s, setS] = useState<Status | null>(null);
  const [msg, setMsg] = useState('');
  const [name, setName] = useState('');
  const [skipMsg, setSkipMsg] = useState('');
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState<{ text?: string; detected?: string; flag?: string; langName?: string; translated?: string; line?: string; sentToChat?: boolean } | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState('');
  const [view, setView] = useState<'kick' | 'twitch' | ''>('');
  viewRef.current = view;

  const load = useCallback(async (p?: string) => {
    const r = await fetch(`/api/kick/status${p ? `?p=${p}` : ''}`).then(r => r.json());
    setS(r);
    if (r.connected && r.platform) setView(r.platform);
  }, []);
  useEffect(() => {
    load(new URLSearchParams(location.search).get('twitch') ? 'twitch' : undefined);
    const onFocus = () => load(viewRef.current || undefined); // !translate in chat changes the switch, so refresh when you come back
    window.addEventListener('focus', onFocus);
    const tick = setInterval(() => { if (document.visibilityState === 'visible') load(viewRef.current || undefined); }, 20000); // a chat command flips a card without anyone touching the page
    const k = new URLSearchParams(location.search).get('kick');
    if (k && NOTES[k]) setMsg(NOTES[k]);
    const t = new URLSearchParams(location.search).get('twitch');
    if (t && TNOTES[t]) setMsg(TNOTES[t]);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(tick); };
  }, [load]);

  // Show the change right away, then save it. If saving fails, go back to what the server has.
  const save = async (patch: Partial<Status>, body: Record<string, unknown>) => {
    setS(prev => (prev ? { ...prev, ...patch } : prev));
    const r = await fetch('/api/kick/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, platform: view }) });
    if (!r.ok) { setMsg((await r.json().catch(() => ({}))).error || 'Could not save.'); load(view); } else setMsg('');
  };
  // The on/off switch of one channel (its card). Optimistic, like save().
  const setOn = async (p: 'kick' | 'twitch', on: boolean) => {
    const now = new Date().toISOString();
    setS(prev => (prev ? { ...prev, ...(prev.platform === p ? { enabled: on } : {}), channels: (prev.channels || []).map(c => (c.platform === p ? { ...c, enabled: on, by: 'the dashboard', at: now } : c)) } : prev));
    const r = await fetch('/api/kick/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: on, platform: p }) });
    if (!r.ok) { setMsg((await r.json().catch(() => ({}))).error || 'Could not save.'); load(view); } else setMsg('');
  };
  const skip = async (body: { skipAdd: string } | { skipRemove: string }, ok: string) => {
    const r = await fetch('/api/kick/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, platform: view }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setSkipMsg(j.error || 'Could not save.'); return; }
    setS(prev => (prev ? { ...prev, skip: j.skip || [] } : prev));
    setSkipMsg(ok);
    if ('skipAdd' in body) setName('');
  };
  const toggleIgnored = (code: string) => {
    const current = new Set(s?.ignoredLanguages || []);
    if (current.has(code)) current.delete(code);
    else current.add(code);
    const list = Array.from(current);
    save({ ignoredLanguages: list }, { ignoredLanguages: list });
  };
  const out = async (p?: string) => { await fetch('/api/kick/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: p || view }) }); setMsg(''); setView(''); load(); };

  const runTest = async (sendToChat = false, sampleText?: string) => {
    const textToRun = (sampleText || testText).trim();
    if (!textToRun) return;
    setTestLoading(true);
    setTestError('');
    try {
      const res = await fetch('/api/kick/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToRun, platform: view, sendToChat })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Test failed.');
      setTestResult(data);
    } catch (e) {
      setTestError((e as Error).message);
    } finally {
      setTestLoading(false);
    }
  };

  const lang = LANGS[s?.language || 'en'] || 'English';
  const used = s?.used || 0, cap = s?.cap || 50000;
  const ex = EX[s?.language || 'en'] || EX.en;
  const anyOn = (s?.channels || []).some(c => c.enabled);
  const replyFlag = s?.replyFlag !== false, replyStyle = s?.replyStyle === 'lang' ? 'lang' : 'colon', replyOrig = Boolean(s?.replyOriginal);
  const srcName = srcLabel(ex.flag === '🇺🇸' ? 'en' : 'es', s?.language || 'en');
  const who = ex.user + (replyStyle === 'lang' ? ` (${srcName})` : '');
  const exLine = `${replyFlag ? ex.flag + ' ' : ''}${who}: ${ex.tr}${replyOrig ? ` [${ex.orig}]` : ''}`;
  const pauses = s?.cooldown != null && !PAUSES.some(p => p[0] === s.cooldown) ? [...PAUSES, [s.cooldown, `${s.cooldown} sec`] as [number, string]] : PAUSES;

  return (
    <>
      <header><div className="wrap">
        <a className="brand" href="/"><img src="/icon.png" alt="" />ChitChatBot</a>
        <nav>
          <a href="/faq.html">FAQ</a>
          {s?.connected && s.admin && <a href="/admin">Admin</a>}
        </nav>
      </div></header>

      <main className="wrap">
        {!s && <p className="msg">Loading…</p>}

        {s && !s.connected && (
          <section>
            <h1>Is chat roasting you? Now you'll know.</h1>
            <p className="lede">Link your Kick or Twitch channel and the bot puts a translation under every message that isn't in your language.</p>
            <div className="cta">
              {s.kickReady ? <a className="btn kick" href="/api/kick/login">Sign in with Kick</a> : <span className="small">Kick app settings are missing on the server.</span>}
              {s.twitchReady && <a className="btn twitch" href="/api/twitch/login">Sign in with Twitch</a>}
              <span className="small">Free. Your chat isn't saved.</span>
            </div>
            {msg && <p className="msg" style={{ marginTop: 18 }}>{msg}</p>}
          </section>
        )}

        {s?.connected && (
          <section>
            <h1>Hey, {s.channel}.</h1>
            <div className="plats">
              {(['kick', 'twitch'] as const).map(p => {
                const mine = (s.channels || []).find(c => c.platform === p);
                const nm = p === 'kick' ? 'Kick' : 'Twitch';
                const ready = p === 'kick' ? s.kickReady : s.twitchReady;
                if (!mine) return ready ? <a key={p} className={`plat ${p === 'kick' ? 'k' : 't'} off`} href={`/api/${p}/login`}><i></i><span><b>{nm}</b><small>not linked</small></span><span className="go">Connect {nm}</span></a> : null;
                return (
                  <div key={p} className={`plat ${p === 'kick' ? 'k' : 't'} lk${mine.enabled ? '' : ' paused'}`}>
                    <div className="ptop"><span><b>{nm}</b><small>{mine.name}<button type="button" className="x" onClick={() => out(p)}>Disconnect</button></small></span>
                      <span className="sw"><span>{mine.enabled ? 'On' : 'Off'}</span><button type="button" className="tog" role="switch" aria-checked={Boolean(mine.enabled)} aria-label={`${nm} translator`} onClick={() => setOn(p, !mine.enabled)} /></span></div>
                  </div>
                );
              })}
            </div>
            {msg && <p className="msg">{msg}</p>}

            <div className="lab">Who gets translated</div>
            <div className="sheet">
              <div className="item"><div className="row">
                <div><div className="t">Your language</div><div className="d">Anything not in {lang} gets translated for you. You're welcome.</div></div>
                <select aria-label="Your language" value={s.language || 'en'} onChange={e => save({ language: e.target.value }, { language: e.target.value })}>
                  {Object.entries(LANGS).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                </select>
              </div></div>

              <div className="item">
                <div className="row">
                  <div>
                    <div className="t">Languages to ignore</div>
                    <div className="d">Languages you already understand. The bot will leave these alone.</div>
                  </div>
                  <span className="d">{(s.ignoredLanguages || []).length} ignored</span>
                </div>
                <div className="chips" style={{ marginTop: 8 }}>
                  {Object.entries(LANGS)
                    .filter(([c]) => c !== (s.language || 'en'))
                    .map(([code, name]) => {
                      const isIgnored = (s.ignoredLanguages || []).includes(code);
                      return (
                        <button
                          key={code}
                          type="button"
                          className="chip"
                          style={{
                            cursor: 'pointer',
                            backgroundColor: isIgnored ? '#ec4899' : 'rgba(255,255,255,0.06)',
                            color: isIgnored ? '#fff' : 'inherit',
                            borderColor: isIgnored ? '#ec4899' : 'rgba(255,255,255,0.1)'
                          }}
                          onClick={() => toggleIgnored(code)}
                          title={isIgnored ? `Click to translate ${name}` : `Click to ignore ${name}`}
                        >
                          {name} {isIgnored ? '✕' : '+'}
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="item"><div className="row">
                <div><div className="t">Pause between translations</div><div className="d">Per person, so nobody hogs the bot. Anything under 3 words is left alone, so lol and gg stay lol and gg.</div></div>
                <select aria-label="Pause between translations per person" value={s.cooldown ?? 30} onChange={e => save({ cooldown: Number(e.target.value) }, { cooldown: Number(e.target.value) })}>
                  {pauses.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                </select>
              </div></div>

              <div className="item">
                <div className="row"><div className="t">Skip list</div><span className="d">{(s.skip || []).length} of 50</span></div>
                <div className="d">The bot won't translate these chatters{(s.channels || []).length > 1 ? ' on Kick or Twitch' : ''}. Other bots, mostly.</div>
                <form className="skipadd" onSubmit={e => { e.preventDefault(); const v = name.trim().replace(/^@+/, ''); if (v) skip({ skipAdd: v }, `${v} is skipped. Their messages stay as they are.`); }}>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Username" autoComplete="off" aria-label="Username" maxLength={40} />
                  <button className="btn pink" type="submit">Add</button>
                </form>
                {skipMsg && <div className="skipnote" aria-live="polite">{skipMsg}</div>}
                <div className="chips">
                  {(s.skip || []).length === 0 && <span className="d">Nobody skipped yet. The bot treats everyone equally.</span>}
                  {(s.skip || []).map(n => <span className="chip" key={n}>{n}<button type="button" aria-label={`Remove ${n}`} onClick={() => skip({ skipRemove: n }, `${n} is back on the menu.`)}>×</button></span>)}
                </div>
              </div>
            </div>

            <div className="lab">Bot reply</div>
            <div className="sheet">
              <div className="item">
                <div className="d">How the translation looks in chat. The box below shows it live.</div>
                <div className="seg" role="group" aria-label="Reply style">
                  <button type="button" aria-pressed={replyStyle === 'colon'} onClick={() => save({ replyStyle: 'colon' }, { replyStyle: 'colon' })}>name: hello</button>
                  <button type="button" aria-pressed={replyStyle === 'lang'} onClick={() => save({ replyStyle: 'lang' }, { replyStyle: 'lang' })}>name ({srcName}): hello</button>
                </div>
                <div className="row sub">
                  <div><div className="t2">Show the flag</div><div className="d">A little flag so chat knows where it came from.</div></div>
                  <button className="tog sm" role="switch" aria-checked={replyFlag} aria-label="Show the flag" onClick={() => save({ replyFlag: !replyFlag }, { replyFlag: !replyFlag })} />
                </div>
                <div className="row sub">
                  <div><div className="t2">Show what they wrote too</div><div className="d">The original goes in brackets. Louder chat, more proof.</div></div>
                  <button className="tog sm" role="switch" aria-checked={replyOrig} aria-label="Show the original message" onClick={() => save({ replyOriginal: !replyOrig }, { replyOriginal: !replyOrig })} />
                </div>
                <div className="ex"><div className="exh">What chat will see</div><div className="chatbox">
                  <div className="m"><span className="u" style={{ color: '#b48cff' }}>{ex.user}:</span> {ex.orig}</div>
                  {anyOn ? <div className="m"><span className="u b">ChitChatBot:</span> {exLine}</div> : <div className="m d">Translator is off, so chat is on its own. Good luck.</div>}
                </div></div>
              </div>
            </div>

            <div className="lab">Live translation tester</div>
            <div className="sheet">
              <div className="item">
                <div className="d">Test how the bot detects and translates any foreign sentence in real time.</div>
                <form className="skipadd" onSubmit={e => { e.preventDefault(); runTest(false); }}>
                  <input
                    value={testText}
                    onChange={e => setTestText(e.target.value)}
                    placeholder="Type anything (e.g. hola a todos, selam nasilsin, こんにちは)"
                    aria-label="Test message"
                    maxLength={300}
                  />
                  <button className="btn primary" type="submit" disabled={testLoading || !testText.trim()}>
                    {testLoading ? 'Translating…' : 'Translate'}
                  </button>
                  <button
                    className="btn pink"
                    type="button"
                    disabled={testLoading || !testText.trim()}
                    onClick={() => runTest(true)}
                    title="Send this translated test line to your live chat"
                  >
                    Send to Chat
                  </button>
                </form>

                <div className="chips" style={{ marginTop: 10 }}>
                  <span className="d" style={{ marginRight: 6 }}>Try sample:</span>
                  {[
                    ['🇪🇸 Spanish', 'hola a todos buen stream bro'],
                    ['🇹🇷 Turkish', 'selam nasilsin abi yayin cok guzel'],
                    ['🇯🇵 Japanese', 'みなさんこんばんは配信お疲れ様です'],
                    ['🇩🇪 German', 'hallo wie gehts dir heute sehr gut gespielt'],
                    ['🇫🇷 French', 'bonjour tout le monde super partie bravo mec'],
                    ['🇷🇺 Russian', 'всем привет отличная игра спс за стрим'],
                    ['🇧🇷 Portuguese', 'salve galera muito boa jogada mano vlw']
                  ].map(([label, sample]) => (
                    <button
                      key={label}
                      type="button"
                      className="chip"
                      style={{ cursor: 'pointer' }}
                      onClick={() => { setTestText(sample); runTest(false, sample); }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {testError && <p className="msg" style={{ marginTop: 12, color: '#ff6b6b' }}>{testError}</p>}

                {testResult && (
                  <div className="ex" style={{ marginTop: 14 }}>
                    <div className="exh">
                      Test Output: {testResult.flag} {testResult.langName} &rarr; {lang}
                      {testResult.sentToChat && <span style={{ marginLeft: 8, color: '#4ade80' }}>✓ Sent to live chat</span>}
                    </div>
                    <div className="chatbox">
                      <div className="m"><span className="u" style={{ color: '#b48cff' }}>Viewer:</span> {testResult.text}</div>
                      <div className="m"><span className="u b">ChitChatBot:</span> {testResult.line}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="lab">Commands</div>
            <div className="sheet">
              <div className="item">
                <div className="d">Type them in either chat.{s.mods ? ' You and your mods can.' : ''}</div>
                <div className={`cmdcols${(s.channels || []).length > 1 ? '' : ' one'}`}>
                  <div className="cc"><div className="ch">{(s.channels || []).length > 1 ? 'This chat' : 'In chat'}</div><div className="cl"><code>!translate off</code><span className="d">off</span></div><div className="cl"><code>!translate on</code><span className="d">on</span></div></div>
                  {(s.channels || []).length > 1 && <div className="cc"><div className="ch">Both chats</div><div className="cl"><code>!translate off all</code><span className="d">off</span></div><div className="cl"><code>!translate on all</code><span className="d">on</span></div></div>}
                </div>
                <div className="row sub">
                  <div><div className="t2">Mods can use the commands</div><div className="d">{s.mods ? 'You and your mods. They get the remote too.' : 'Just you. Mods can watch, not touch.'}</div></div>
                  <button className="tog sm" role="switch" aria-checked={Boolean(s.mods)} aria-label="Let mods use the translate commands" onClick={() => save({ mods: !s.mods }, { mods: !s.mods })} />
                </div>
              </div>
            </div>

            <div className="lab">Plan</div>
            <div className="sheet">
              <div className="item">
                <div className="row"><div className="t" style={{ whiteSpace: 'nowrap' }}>Free plan</div><span className="d">{used.toLocaleString()} of {cap.toLocaleString()} characters. Plenty left.</span></div>
                <div className="line"><i style={{ width: `${Math.min(100, (used / cap) * 100)}%` }} /></div>
                {used >= cap && <div className="d" style={{ marginTop: 10 }}>You've used this month's free translations. The bot is quiet until next month.</div>}
              </div>
            </div>

            {!s.translatorReady && <p className="note">The translation key isn't set on the server yet.</p>}
          </section>
        )}
      </main>
    </>
  );
}
