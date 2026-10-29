'use client';
import { useEffect, useState } from 'react';

type Row = { id: string; name: string; platform?: string; joined: string; linked: boolean; on: boolean; language: string; plan: string; used: number };

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function AdminView({ me }: { me: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [cap, setCap] = useState(50000);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState('');
  const [sure, setSure] = useState('');

  const load = async () => { const j = await fetch('/api/admin/list').then(r => r.json()); setRows(j.rows || []); setCap(j.cap || 50000); };
  useEffect(() => { load(); }, []);

  const disconnect = async (id: string) => {
    if (sure !== id) { setSure(id); return; }
    await fetch('/api/admin/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setSure(''); load();
  };

  const all = rows || [];
  const shown = all.filter(r => r.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <header><div className="wrap wide">
        <a className="brand" href="/dashboard"><img src="/icon.png" alt="" />ChitChatBot <span className="who">· Admin</span></a>
        <span className="who">{me}</span>
      </div></header>
      <main className="wrap wide">
        <h1>Who's using it</h1>
        <div className="stats">
          <div className="stat"><b>{all.length}</b><span>Streamers</span></div>
          <div className="stat"><b>{all.filter(r => r.on).length}</b><span>Translator on</span></div>
          <div className="stat"><b>{all.reduce((a, r) => a + r.used, 0).toLocaleString()}</b><span>Characters this month</span></div>
        </div>
        <input className="search" type="search" placeholder="Search channels" aria-label="Search channels" value={q} onChange={e => setQ(e.target.value)} />
        <div className="sheet list">
          {!rows && <div className="empty">Loading…</div>}
          {rows && !shown.length && <div className="empty">Nobody by that name.</div>}
          {shown.map(r => (
            <div className="r" key={r.id}>
              <button className="rh" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? '' : r.id)}>
                <span className={`dot${r.on ? ' on' : ''}`} />
                <span className="nm"><b>{r.name}</b><span>{r.platform === 'twitch' ? 'Twitch · ' : ''}Joined {day(r.joined)}{r.linked ? '' : ' · disconnected'}</span></span>
                <span className="use">{r.used.toLocaleString()}<i><u style={{ width: `${Math.min(100, (r.used / cap) * 100)}%` }} /></i></span>
              </button>
              {open === r.id && (
                <div className="rb">
                  <div className="info">
                    <span>Plan <b>{r.plan[0].toUpperCase() + r.plan.slice(1)}</b></span>
                    <span>Language <b>{r.language}</b></span>
                    <span>Translator <b>{r.on ? 'On' : 'Off'}</b></span>
                    <span>Used <b>{r.used.toLocaleString()} of {cap.toLocaleString()}</b></span>
                  </div>
                  {r.linked && <button className="abtn warn" onClick={() => disconnect(r.id)}>{sure === r.id ? 'Sure? Click again' : 'Disconnect'}</button>}
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="note">No chat is stored here. Only who signed up and how many characters they translated.</p>
      </main>
    </>
  );
}
