'use client';
import { useEffect, useState } from 'react';

type Status = { connected: boolean; kickReady?: boolean; translatorReady?: boolean; channel?: string; enabled?: boolean; cooldown?: number };

export default function Dashboard() {
  const [s, setS] = useState<Status | null>(null);
  const [cooldown, setCooldown] = useState(30);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const r = await fetch('/api/kick/status').then(r => r.json());
    setS(r);
    if (r.cooldown != null) setCooldown(r.cooldown);
  };
  useEffect(() => {
    load();
    const onFocus = () => load(); // a !translate command in chat changes the switch, so refresh when you come back
    window.addEventListener('focus', onFocus);
    const k = new URLSearchParams(location.search).get('kick');
    if (k) setMsg({ connected: 'Kick connected. Chat is linked.', denied: 'Kick sign-in was cancelled.', expired: 'That sign-in expired. Try again.', error: 'Could not finish connecting Kick.' }[k] || '');
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const save = async (enabled: boolean) => {
    const r = await fetch('/api/kick/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled, cooldown }) });
    const j = await r.json();
    setMsg(r.ok ? (enabled ? 'Translator on.' : 'Translator off.') : j.error);
    load();
  };
  const test = async () => {
    const r = await fetch('/api/kick/test', { method: 'POST' });
    const j = await r.json();
    setMsg(r.ok ? 'Sent. Check your Kick chat.' : j.error);
  };
  const disconnect = async () => { await fetch('/api/kick/disconnect', { method: 'POST' }); setMsg('Disconnected.'); load(); };

  return (
    <main className="wrap">
      <img className="logo" src="/logo.png" alt="ChitChatBot" />
      <h1>Bot test</h1>
      {!s && <p className="note">Loading…</p>}
      {s && !s.connected && (
        <>
          <p className="lede">Link your Kick channel so the bot can read chat and post translations.</p>
          {s.kickReady ? <a className="btn" href="/api/kick/login">Sign in with Kick</a> : <p className="note">Kick app settings are missing on the server.</p>}
        </>
      )}
      {s?.connected && (
        <div className="card">
          <p className="lede" style={{ margin: 0 }}>Linked to <b>{s.channel}</b></p>
          <label className="row">Seconds between translations per person
            <input type="number" min={0} max={600} value={cooldown} onChange={e => setCooldown(Number(e.target.value))} />
          </label>
          <div className="row">
            {s.enabled
              ? <button className="btn" onClick={() => save(false)}>Turn translator off</button>
              : <button className="btn" onClick={() => save(true)}>Turn translator on</button>}
            <button className="btn ghost" onClick={() => save(Boolean(s.enabled))}>Save cooldown</button>
          </div>
          <div className="row">
            <button className="btn ghost" onClick={test}>Send a test line</button>
            <button className="btn ghost" onClick={disconnect}>Disconnect</button>
          </div>
          {!s.translatorReady && <p className="note">Translation key not set on the server yet.</p>}
        </div>
      )}
      {msg && <p className="note">{msg}</p>}
    </main>
  );
}
