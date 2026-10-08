import React, { useState } from 'react';
import { Card, Wordmark } from './ui.jsx';
import { useClan } from '../clanContext.js';
import { unlockClan } from '../services/db.js';

/** Shown instead of the pages when a clan's published data is encrypted and this device has not unlocked it. */
export default function Lock({ onDone }) {
  const { name } = useClan(), [pass, setPass] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!pass.trim() || busy) return;
    if (!globalThis.crypto?.subtle) { setErr("This browser can't unlock the records here. Open the site with https."); return; }
    setBusy(true); setErr('');
    const ok = await unlockClan(pass); setBusy(false);
    if (ok) onDone(); else setErr('Wrong passphrase. Ask your clan leader for the right one.');
  };
  return (
    <Card className="hero">
      <Wordmark size={30} bar />
      <h2>🔒 Members only</h2>
      <div className="sub">The {name} records are private. Enter the clan passphrase to view them. This device will remember it.</div>
      <input type="password" value={pass} placeholder="Clan passphrase" aria-label="Clan passphrase" autoComplete="off" style={{ marginTop: 14 }} onChange={e => { setPass(e.target.value); setErr(''); }} onKeyDown={e => e.key === 'Enter' && submit()} />
      {err && <div className="err">⚠ {err}</div>}
      <button className="btn" style={{ marginTop: 12 }} disabled={busy || !pass.trim()} onClick={submit}>{busy ? 'Unlocking…' : 'Unlock'}</button>
    </Card>
  );
}
