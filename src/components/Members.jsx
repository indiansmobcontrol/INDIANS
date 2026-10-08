import React, { useEffect, useState } from 'react';
import { Card } from './ui.jsx';
import { useClan } from '../clanContext.js';
import { cloudMembers, cloudSaveMembers } from '../services/cloud.js';

const EMAIL = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/;
/** Pull email addresses out of pasted text (any mix of lines, commas, spaces, "Name <a@b.com>"). */
export function parseEmails(text) {
  const plain = String(text || '').replace(/[^<>,;\n]*<([^<>\s]+)>/g, ' $1 '); // "Pat Smith <pat@gmail.com>" -> pat@gmail.com
  const tokens = plain.split(/[\s,;]+/).map(t => t.replace(/^[<"'(]+|[>"'),.]+$/g, '').toLowerCase()).filter(Boolean);
  const valid = tokens.filter(t => EMAIL.test(t)), invalid = tokens.filter(t => !EMAIL.test(t));
  const unique = [...new Set(valid)];
  return { emails: unique, duplicates: valid.length - unique.length, invalid };
}

/** Admin screen: the approved Gmail addresses of the clan being viewed (works for hundreds of members). */
export default function Members() {
  const clan = useClan();
  const [existing, setExisting] = useState(null), [text, setText] = useState(''), [msg, setMsg] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  useEffect(() => { let live = true; setExisting(null); setMsg(null); cloudMembers(clan.id).then(l => { if (live) { setExisting(l); setText(l.join('\n')); } }).catch(e => live && setErr(e.message || String(e))); return () => { live = false; }; }, [clan.id]);
  const p = parseEmails(text), cur = new Set(existing || []), add = p.emails.filter(e => !cur.has(e)).length, rem = (existing || []).filter(e => !p.emails.includes(e)).length;
  const load = async f => { if (!f) return; const more = await f.text(); setText(t => (t.trim() ? t.trim() + '\n' : '') + more); };
  const save = async () => {
    if (rem > 0 && !confirm(`This removes access for ${rem} member${rem === 1 ? '' : 's'} who are not in the box. Continue?`)) return;
    setBusy(true); setMsg(null); setErr('');
    try { const r = await cloudSaveMembers(clan.id, p.emails); setExisting(p.emails.slice().sort()); setMsg(`Saved. Added ${r.added}, removed ${r.removed}. ${r.total} approved members.`); }
    catch (e) { setErr(e.code === 'permission-denied' ? 'Firebase refused this change. Only the admin Gmail in your Firestore rules can edit members.' : (e.message || String(e))); }
    setBusy(false);
  };
  return (
    <Card title={`Approved members · ${clan.name}`} sub="Only these Gmail addresses can see this clan's records. Paste one per line, or separated by commas or spaces. The box always shows who is approved right now, so removing a line and saving removes that person.">
      <textarea value={text} onChange={e => { setText(e.target.value); setMsg(null); }} rows={8} placeholder="name1@gmail.com&#10;name2@gmail.com" aria-label="Approved member emails" style={{ marginTop: 12, minHeight: 140, fontFamily: 'inherit' }} />
      <input type="file" accept=".csv,.txt" aria-label="Add emails from a file" onChange={e => { load(e.target.files[0]); e.target.value = ''; }} style={{ marginTop: 8 }} />
      <div className="sub" style={{ margin: '10px 0' }}>{existing == null ? 'Loading the current list…' : <>Approved now: <b>{existing.length}</b> · In the box: <b>{p.emails.length}</b> valid{p.duplicates > 0 && ` (${p.duplicates} duplicate${p.duplicates === 1 ? '' : 's'} ignored)`} · This save: <span className="pos">+{add}</span> / <span className="neg">−{rem}</span></>}</div>
      {p.invalid.length > 0 && <div className="err">⚠ {p.invalid.length} entr{p.invalid.length === 1 ? 'y is' : 'ies are'} not a valid email and will be ignored: {p.invalid.slice(0, 5).join(', ')}{p.invalid.length > 5 ? ' …' : ''}</div>}
      <div className="sub">Each person must sign in with exactly this address. Gmail ignores dots, but this list does not, so <i>john.doe@gmail.com</i> and <i>johndoe@gmail.com</i> are different here.</div>
      <button className="btn" style={{ marginTop: 12 }} disabled={busy || existing == null || (add === 0 && rem === 0)} onClick={save}>{busy ? 'Saving…' : 'Save members'}</button>
      {msg && <div className="pos" style={{ marginTop: 8 }}>✓ {msg}</div>}
      {err && <div className="err">⚠ {err}</div>}
    </Card>
  );
}
