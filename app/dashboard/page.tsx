'use client';
import { useCallback, useEffect, useState } from 'react';

type Status = {
  connected: boolean; kickReady?: boolean; translatorReady?: boolean; channel?: string; admin?: boolean;
  enabled?: boolean; cooldown?: number; language?: string; mods?: boolean; used?: number; cap?: number;
};

const LANGS: Record<string, string> = { en: 'English', es: 'Spanish', pt: 'Portuguese', fr: 'French', ja: 'Japanese', ko: 'Korean' };
const PAUSES: [number, string][] = [[0, 'None'], [10, '10 sec'], [30, '30 sec'], [60, '1 min'], [120, '2 min'], [300, '5 min']];
const NOTES: Record<string, string> = { connected: 'Kick connected.', denied: 'Kick sign-in was cancelled.', expired: 'That sign-in expired. Try again.', error: 'Could not finish connecting Kick.' };

export default function Dashboard() {
  const [s, setS] = useState<Status | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => { setS(await fetch('/api/kick/status').then(r => r.json())); }, []);
  useEffect(() => {
    load();
    const onFocus = () => load(); // !translate in chat changes the switch, so refresh when you come back
    window.addEventListener('focus', onFocus);
    const k = new URLSearchParams(location.search).get('kick');
    if (k && NOTES[k]) setMsg(NOTES[k]);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  // Show the change right away, then save it. If saving fails, go back to what the server has.
  const save = async (patch: Partial<Status>, body: Record<string, unknown>) => {
    setS(prev => (prev ? { ...prev, ...patch } : prev));
    const r = await fetch('/api/kick/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) { setMsg((await r.json().catch(() => ({}))).error || 'Could not save.'); load(); } else setMsg('');
  };
  const test = async () => { const r = await fetch('/api/kick/test', { method: 'POST' }); setMsg(r.ok ? 'Sent. Check your Kick chat.' : (await r.json().catch(() => ({}))).error || 'Could not send.'); };
  const out = async () => { await fetch('/api/kick/disconnect', { method: 'POST' }); setMsg(''); load(); };

  const lang = LANGS[s?.language || 'en'] || 'English';
  const used = s?.used || 0, cap = s?.cap || 50000;
  const pauses = s?.cooldown != null && !PAUSES.some(p => p[0] === s.cooldown) ? [...PAUSES, [s.cooldown, `${s.cooldown} sec`] as [number, string]] : PAUSES;

  return (
    <>
      <header><div className="wrap">
        <a className="brand" href="/"><img src="/icon.png" alt="" />ChitChatBot</a>
        <nav>
          <a href="/faq.html">FAQ</a>
          {s?.connected && s.admin && <a href="/admin">Admin</a>}
          {s?.connected && <button onClick={out}>Sign out</button>}
        </nav>
      </div></header>

      <main className="wrap">
        {!s && <p className="msg">Loading…</p>}

        {s && !s.connected && (
          <section>
            <h1>Is chat roasting you? Now you'll know.</h1>
            <p className="lede">Link your Kick channel and the bot puts a translation under every message that isn't in your language.</p>
            <div className="cta">
              {s.kickReady ? <a className="btn" href="/api/kick/login">Sign in with Kick</a> : <span className="small">Kick app settings are missing on the server.</span>}
              <span className="small">Free. Your chat isn't saved.</span>
            </div>
            {msg && <p className="msg" style={{ marginTop: 18 }}>{msg}</p>}
          </section>
        )}

        {s?.connected && (
          <section>
            <h1>Hey, {s.channel}.</h1>
            <p className="on"><i></i>Connected to Kick</p>
            {msg && <p className="msg">{msg}</p>}

            <div className="sheet">
              <div className="item">
                <div className="row">
                  <div>
                    <div className="t">Translator</div>
                    <div className="d">{s.enabled ? `On. Chat gets a ${lang} line.` : 'Off. Chat is on its own.'}</div>
                    <div className="cmds"><code>!translate on</code><code>!translate off</code><span className="d">in your chat</span></div>
                  </div>
                  <button className="tog" role="switch" aria-checked={Boolean(s.enabled)} aria-label="Translator" onClick={() => save({ enabled: !s.enabled }, { enabled: !s.enabled })} />
                </div>
                <div className="row sub">
                  <div><div className="t2">Mods can use the commands</div><div className="d">{s.mods ? 'You and your mods.' : 'Just you.'}</div></div>
                  <button className="tog sm" role="switch" aria-checked={Boolean(s.mods)} aria-label="Let mods use the translate commands" onClick={() => save({ mods: !s.mods }, { mods: !s.mods })} />
                </div>
              </div>

              <div className="item"><div className="row">
                <div><div className="t">Your language</div><div className="d">Messages not in {lang} get translated to {lang}.</div></div>
                <select aria-label="Your language" value={s.language || 'en'} onChange={e => save({ language: e.target.value }, { language: e.target.value })}>
                  {Object.entries(LANGS).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                </select>
              </div></div>

              <div className="item"><div className="row">
                <div><div className="t">Pause between translations</div><div className="d">Per person, so one chatter can't take over. Messages under 3 words are skipped, so "lol" and "gg" stay as they are.</div></div>
                <select aria-label="Pause between translations per person" value={s.cooldown ?? 30} onChange={e => save({ cooldown: Number(e.target.value) }, { cooldown: Number(e.target.value) })}>
                  {pauses.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                </select>
              </div></div>

              <div className="item">
                <div className="row"><div className="t">Free plan</div><span className="d">{used.toLocaleString()} of {cap.toLocaleString()} characters</span></div>
                <div className="line"><i style={{ width: `${Math.min(100, (used / cap) * 100)}%` }} /></div>
                {used >= cap && <div className="d" style={{ marginTop: 10 }}>You've used this month's free translations. The bot is quiet until next month.</div>}
              </div>
            </div>

            {!s.translatorReady && <p className="note">The translation key isn't set on the server yet.</p>}
            <div className="foot"><button onClick={test}>Send a test line</button><button onClick={out}>Disconnect Kick</button></div>
          </section>
        )}
      </main>
    </>
  );
}
