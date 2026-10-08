import React, { useState } from 'react';
import { Card, useDb } from '../components/ui.jsx';
import { useClan } from '../clanContext.js';
import { CLANS } from '../clans.js';
import Members from '../components/Members.jsx';
import { cloudEnabled, cloudPublish, cloudSignIn, cloudSignOut } from '../services/cloud.js';
import { getUser } from '../services/session.js';
import { exportCompact } from '../services/db.js';
import { signInMessage } from '../components/Access.jsx';
import { saveWeek, previewCsv, commitCsv, resetDb, addPlayer, renamePlayer, setStatus, deletePlayer, deleteWeek, deleteKrakenMonth, deleteWeekEvent, orphanPlayers, deleteOrphans, getUndo, undoLast, getAllPlayers } from '../services/db.js';
import { unlock, getToken, setToken, clearToken, getRepo, saveRepo, repoFromLocation, publishToGitHub, getPubPass, setPubPass, clearPubPass, buildPublishText, MIN_PASS } from '../services/admin.js';
import { weeksDesc, weekRows, krMonths, krMonthRows } from '../services/stats.js';
import { makeWeekId, weekRange, weekLabel, monthLabel, fmtDmg, fmtSparks } from '../utils/format.js';

function WeekForm({ initial, onDone }) {
  const db = useDb(), edit = !!initial, latest = weeksDesc(db)[0];
  const [num, setNum] = useState(initial?.weekNumber ?? (latest ? latest.weekNumber + 1 : 1)), [year, setYear] = useState(Number((initial?.id || latest?.id || '2026-W01').slice(0, 4)));
  const id = makeWeekId(year, num), auto = weekRange(id);
  const [dates, setDates] = useState(initial ? [initial.startDate, initial.endDate] : null);
  const [start, end] = dates || [auto.startDate, auto.endDate];
  const [rows, setRows] = useState(() => {
    if (!initial) return [];
    const m = {}; ['pr', 'sr'].forEach(k => weekRows(db, k, initial.id).forEach(r => ((m[r.playerId] ||= { playerId: r.playerId })[k] = r.score)));
    return Object.values(m);
  });
  const [errs, setErrs] = useState([]);
  const upd = (i, f, v) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, [f]: v } : r)));
  const live = k => { const s = rows.filter(r => r[k] !== '' && r[k] != null && Number(r[k]) >= 0).sort((a, b) => b[k] - a[k]); return Object.fromEntries(s.map((r, i) => [r.playerId, i + 1])); };
  const rp = live('pr'), rs = live('sr'), free = db.players.filter(p => !rows.some(r => r.playerId === p.id));
  const save = () => { const e = saveWeek({ id, startDate: start, endDate: end }, rows, { edit }); setErrs(e); if (!e.length) onDone(); };
  return (
    <Card title={edit ? `Edit ${id}` : 'Add New Week'} sub="Ranks are calculated automatically from scores">
      <div className="stats" style={{ gridTemplateColumns: '1fr 1fr', margin: '10px 0' }}>
        <label><span className="up">Year</span><input type="number" value={year} disabled={edit} onChange={e => { setYear(+e.target.value); setDates(null); }} /></label>
        <label><span className="up">Week number</span><input type="number" min="1" max="53" value={num} disabled={edit} onChange={e => { setNum(+e.target.value); setDates(null); }} /></label>
        <label><span className="up">Start</span><input type="date" value={start} onChange={e => setDates([e.target.value, end])} /></label>
        <label><span className="up">End</span><input type="date" value={end} onChange={e => setDates([start, e.target.value])} /></label>
      </div>
      <div className="scroll"><table className="tbl"><thead><tr><th>PLAYER</th><th>PR</th><th>#</th><th>SR</th><th>#</th><th /></tr></thead><tbody>
        {rows.map((r, i) => <tr key={r.playerId}><td style={{ minWidth: 110 }}>{db.players.find(p => p.id === r.playerId)?.name || r.playerId}</td>
          <td><input style={{ width: 90 }} inputMode="numeric" aria-label="PR score" value={r.pr ?? ''} onChange={e => upd(i, 'pr', e.target.value)} /></td><td>{rp[r.playerId] || '—'}</td>
          <td><input style={{ width: 120 }} inputMode="numeric" aria-label="SR score" value={r.sr ?? ''} onChange={e => upd(i, 'sr', e.target.value)} /></td><td>{rs[r.playerId] || '—'}</td>
          <td><button className="btn g" aria-label="Remove" onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</button></td></tr>)}</tbody></table></div>
      <div className="row" style={{ margin: '10px 0' }}><select value="" onChange={e => e.target.value && setRows([...rows, { playerId: e.target.value, pr: '', sr: '' }])} aria-label="Add player"><option value="">+ Add player…</option>{free.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <button className="btn g" style={{ whiteSpace: 'nowrap' }} onClick={() => setRows([...rows, ...db.players.filter(p => p.status === 'Active' && !rows.some(r => r.playerId === p.id)).map(p => ({ playerId: p.id, pr: '', sr: '' }))])}>All active</button></div>
      {errs.map((e, i) => <div key={i} className="err">⚠ {e}</div>)}
      <div className="row"><button className="btn g" onClick={onDone}>Cancel</button><button className="btn" onClick={save}>{edit ? 'Save changes' : 'Save week'}</button></div>
    </Card>);
}
function Import() {
  const db = useDb();
  const [text, setText] = useState(''), [map, setMap] = useState({}), [msg, setMsg] = useState(''), [millions, setMillions] = useState(false);
  const pv = text ? previewCsv(text, map, { millions }) : null;
  const good = pv?.rows?.filter(r => !r.issues.length) || [], bad = (pv?.rows?.length || 0) - good.length;
  const creating = (pv?.newNames || []).filter(n => !map[n]).length, kr = pv?.kind === 'kraken', newWeeks = [...new Set(good.filter(r => (kr ? r.isNewMonth : r.isNewWeek)).map(r => (kr ? r.monthId : r.weekId)))];
  const load = async f => { if (!f) return; setMsg(''); setMap({}); setText(await f.text()); };
  const pick = (n, v) => setMap(m => ({ ...m, [n]: v || undefined }));
  return (
    <Card title="Import scores (CSV)" sub="Weekly file: Week, Event (PR or SR), Player, Score. Kraken (monthly) file: Month, Player, Rank, Dmg, Sparks. The type is detected automatically; new player names are added automatically.">
      <input type="file" accept=".csv,text/csv,.txt" onChange={e => { load(e.target.files[0]); e.target.value = ''; }} aria-label="CSV file" style={{ marginTop: 10 }} />
      {pv?.fatal && <div className="err">⚠ {pv.fatal}</div>}
      {pv?.rows?.length > 0 && <>
        <div className="note" style={{ marginTop: 10 }}><b>{good.length}</b> rows ready{bad > 0 && <> · <span className="neg"><b>{bad}</b> with problems (skipped)</span></>} · <b>{creating}</b> new player{creating === 1 ? '' : 's'} · <b>{newWeeks.length}</b> new {kr ? 'month' : 'week'}{newWeeks.length === 1 ? '' : 's'}{newWeeks.length > 0 && ` (${newWeeks.join(', ')})`}</div>
        {kr && <div style={{ marginTop: 10 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={millions} onChange={e => setMillions(e.target.checked)} style={{ width: 18, minHeight: 18 }} />My plain numbers (without an “M”) are already in millions</label>
          {!millions && Math.max(0, ...good.map(r => r.damage)) < 1e5 && good.length > 0 && <div className="err">⚠ The largest damage here is {fmtDmg(Math.max(...good.map(r => r.damage)))}. If your sheet holds values like 598.4 meaning 598.4M, tick the box above before importing.</div>}
        </div>}
        {pv.newNames.length > 0 && <details style={{ marginTop: 10 }} open={db.players.length > 0 && pv.newNames.length <= 10}>
          <summary>Check new names ({pv.newNames.length}). Spelled differently? Match to an existing player</summary>
          {pv.newNames.map(n => <div key={n} className="row" style={{ margin: '6px 0' }}><span className="nm">{n}{pv.similar[n] && <small className="neg">⚠ looks like “{pv.similar[n]}”</small>}</span>
            <select style={{ maxWidth: 190 }} value={map[n] || ''} onChange={e => pick(n, e.target.value)} aria-label={`Match ${n}`}><option value="">Create new player</option>{db.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>)}
        </details>}
        <div className="scroll" style={{ maxHeight: '45vh', overflow: 'auto', marginTop: 10 }}><table className="tbl">
          {kr
            ? <><thead><tr><th>LINE</th><th>MONTH</th><th>PLAYER</th><th>RANK</th><th>DAMAGE</th><th>SPARKS</th><th>STATUS</th></tr></thead><tbody>
              {pv.rows.map(r => <tr key={r.line}><td>{r.line}</td><td>{r.monthId || r.rawMonth}</td><td>{r.name}{r.isNewPlayer && !r.issues.length && <span className="pos"> ●new</span>}</td><td>{r.rank ?? 'auto'}</td><td>{Number.isFinite(r.damage) ? fmtDmg(r.damage) : '?'}</td><td>{Number.isFinite(r.sparks) ? fmtSparks(r.sparks) : '?'}</td><td className={r.issues.length ? 'neg' : 'pos'}>{r.issues.length ? r.issues.join('; ') : r.hidden ? 'OK (left clan, stays hidden)' : 'OK'}</td></tr>)}</tbody></>
            : <><thead><tr><th>LINE</th><th>WEEK</th><th>EVENT</th><th>PLAYER</th><th>SCORE</th><th>STATUS</th></tr></thead><tbody>
              {pv.rows.map(r => <tr key={r.line}><td>{r.line}</td><td>{r.weekId || r.rawWeek}</td><td>{r.ev?.toUpperCase() || '?'}</td><td>{r.name}{r.isNewPlayer && !r.issues.length && <span className="pos"> ●new</span>}</td><td>{Number.isFinite(r.score) ? r.score.toLocaleString('en-US') : '?'}</td><td className={r.issues.length ? 'neg' : 'pos'}>{r.issues.length ? r.issues.join('; ') : r.hidden ? 'OK (left clan, stays hidden)' : 'OK'}</td></tr>)}</tbody></>}
        </table></div>
        <div className="row" style={{ marginTop: 12 }}><button className="btn g" onClick={() => { setText(''); setMap({}); }}>Cancel</button>
          <button className="btn" disabled={!good.length} onClick={() => { const r = commitCsv(pv.rows); setMsg(kr ? `Imported ${r.rows} Kraken rows · ${r.players} new players · ${r.months} new month${r.months === 1 ? '' : 's'}.` : `Imported ${r.rows} scores · ${r.players} new players · ${r.weeks} new weeks.`); setText(''); setMap({}); }}>Confirm import</button></div>
        <div className="sub" style={{ marginTop: 6 }}>Existing scores are never overwritten. Problem rows are skipped: fix them in your sheet and upload again.</div></>}
      {msg && <div className="pos" style={{ marginTop: 8 }}>✓ {msg}</div>}
    </Card>);
}

function Players() {
  const db = useDb(), all = getAllPlayers(), [name, setName] = useState(''), [err, setErr] = useState('');
  const left = all.filter(p => p.status === 'Left').length;
  const del = p => { if (confirm(`Permanently delete ${p.name} and ALL of their scores?\n\nThis cannot be undone. To keep their history but hide them, set the status to "Left clan (hidden)" instead.`)) deletePlayer(p.id); };
  return (
    <Card title={`Players (${all.length - left}${left ? ` + ${left} hidden` : ''})`} sub="Added automatically from imports. Someone left? Set “Left clan (hidden)” to remove them from the site but keep the data, or Delete to erase them.">
      {all.length > 0 && <details style={{ marginTop: 10 }}><summary>Show / rename / remove players</summary>
        <div className="bd">{all.map(p => <div key={p.id} className="lr" style={{ gridTemplateColumns: '1fr', gap: 6, opacity: p.status === 'Left' ? 0.55 : 1 }}>
          <div className="row" style={{ justifyContent: 'flex-start' }}><span className="rk">{p.id}</span><b className="nm">{p.name}</b></div>
          <div className="row"><select style={{ flex: 1 }} value={p.status} onChange={e => setStatus(p.id, e.target.value)} aria-label={`Status of ${p.name}`}><option value="Active">Active</option><option value="Inactive">Inactive</option><option value="Left">Left clan (hidden)</option></select>
            <button className="btn g" onClick={() => { const n = prompt(`New name for ${p.name}:`, p.name); if (n != null) { const e = renamePlayer(p.id, n); if (e) alert(e); } }}>Rename</button>
            <button className="btn g" style={{ color: 'var(--red)' }} onClick={() => del(p)}>Delete</button></div></div>)}</div></details>}
      {orphanPlayers().length > 0 && <button className="btn g red" style={{ marginTop: 12 }} onClick={() => { const o = orphanPlayers(); if (confirm(`Remove ${o.length} player${o.length === 1 ? '' : 's'} that have no scores at all?\n\n${o.slice(0, 12).map(p => p.name).join(', ')}${o.length > 12 ? ', …' : ''}`)) deleteOrphans(); }}>Remove {orphanPlayers().length} player{orphanPlayers().length === 1 ? '' : 's'} with no scores</button>}
      <div className="row" style={{ marginTop: 12 }}><input value={name} placeholder="Add a player manually…" aria-label="New player name" onChange={e => setName(e.target.value)} /><button className="btn g" onClick={() => { const e = addPlayer(name); setErr(e); if (!e) setName(''); }}>Add</button></div>
      {err && <div className="err">⚠ {err}</div>}
    </Card>);
}

function CloudGate() {
  const user = getUser(), [err, setErr] = useState('');
  return (
    <Card title="Owner access" sub={user ? `You are signed in as ${user.email}, which is not an admin of this site.` : 'This page is only for the site owner. Sign in with the admin Google account.'}>
      {user
        ? <button className="btn g" style={{ marginTop: 12 }} onClick={() => cloudSignOut()}>Use another account</button>
        : <button className="btn" style={{ marginTop: 12 }} onClick={async () => { try { await cloudSignIn(); } catch (e) { setErr(signInMessage(e)); } }}>Sign in with Google</button>}
      {err && <div className="err">⚠ {err}</div>}
    </Card>);
}
export function Gate({ onUnlock }) {
  if (cloudEnabled) return <CloudGate />;
  const [code, setCode] = useState(''), [err, setErr] = useState('');
  const submit = () => { if (unlock(code)) onUnlock(); else setErr('Wrong passcode.'); };
  return (
    <Card title="Owner access" sub="This page is only for the site owner. Enter the passcode to manage the data.">
      <input type="password" value={code} placeholder="Passcode" aria-label="Passcode" autoComplete="current-password" style={{ marginTop: 12 }} onChange={e => { setCode(e.target.value); setErr(''); }} onKeyDown={e => e.key === 'Enter' && submit()} />
      {err && <div className="err">⚠ {err}</div>}
      <button className="btn" style={{ marginTop: 12 }} onClick={submit}>Unlock</button>
    </Card>);
}

function Publish({ onLock }) {
  const clan = useClan();
  const saved = getRepo(), guess = repoFromLocation();
  const [owner, setOwner] = useState(saved.owner || guess.owner), [repo, setRepo] = useState(saved.repo || guess.repo);
  const [pubPass, setPubPassState] = useState(getPubPass()), [passDraft, setPassDraft] = useState(''), [passErr, setPassErr] = useState('');
  const [tok, setTok] = useState(getToken()), [draft, setDraft] = useState(''), [msg, setMsg] = useState(null), [busy, setBusy] = useState(false), [copied, setCopied] = useState(false);
  const publish = async () => { setBusy(true); setMsg(null); saveRepo(owner, repo); setMsg(await publishToGitHub({ owner: owner.trim(), repo: repo.trim(), token: tok, path: 'public/' + clan.file })); setBusy(false); };
  const dl = async () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([await buildPublishText()], { type: 'application/json' })); a.download = clan.file; a.click(); };
  const copy = async () => { try { await navigator.clipboard.writeText(await buildPublishText()); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { alert('Copy failed. Use Download data.json instead.'); } };
  return (
    <Card title="Publish to the website" sub={`Imports are saved only in this browser until you publish. Publishing saves ${CLANS.length > 1 ? clan.name + "'s data" : "them"} to GitHub (public/${clan.file}) so everyone, including your phone, sees it. Only someone with your private token can do this.`}>
      <div className="g2" style={{ marginTop: 12, gap: 8 }}>
        <input value={owner} onChange={e => setOwner(e.target.value)} placeholder="GitHub username" aria-label="GitHub username" />
        <input value={repo} onChange={e => setRepo(e.target.value)} placeholder="Repository name" aria-label="Repository name" />
      </div>
      <div style={{ marginTop: 14 }}>
        <div className="up">Members-only access</div>
        {pubPass
          ? <div className="pos" style={{ fontSize: 13, marginTop: 4 }}>🔒 ON: {clan.name}'s published data is encrypted. Only people with the passphrase can read it.</div>
          : <div className="sub" style={{ marginTop: 4 }}>🌐 OFF: anyone with the website link can read the published data.</div>}
        <details style={{ marginTop: 8 }} open={!pubPass}><summary>{pubPass ? 'Change or turn off the passphrase' : 'Turn on members-only access'}</summary>
          <div className="sub" style={{ margin: '8px 0' }}>Choose a long passphrase (a few random words is best) and share it only with {clan.name} members. It applies the next time you publish.</div>
          <div className="row"><input type="password" value={passDraft} onChange={e => { setPassDraft(e.target.value); setPassErr(''); }} placeholder="New clan passphrase" aria-label="Members passphrase" autoComplete="off" />
            <button className="btn g" onClick={() => { if (passDraft.trim().length < MIN_PASS) { setPassErr(`Use at least ${MIN_PASS} characters.`); return; } setPubPass(passDraft); setPubPassState(passDraft.trim()); setPassDraft(''); }}>Save</button></div>
          {passErr && <div className="err">⚠ {passErr}</div>}
          {pubPass && <button className="btn g red" style={{ marginTop: 8 }} onClick={() => { if (confirm('Turn off members-only access? The next publish will make the data readable by anyone with the link.')) { clearPubPass(); setPubPassState(''); } }}>Turn off (publish publicly)</button>}
        </details>
      </div>
      {!tok ? (
        <details style={{ marginTop: 12 }} open><summary>Set up one-click publish (do this once)</summary>
          <ol className="sub" style={{ lineHeight: 1.7, paddingLeft: 18 }}>
            <li>On GitHub: profile picture → <b>Settings</b> → <b>Developer settings</b> → <b>Personal access tokens</b> → <b>Fine-grained tokens</b> → <b>Generate new token</b>.</li>
            <li>Repository access: <b>Only select repositories</b> → choose your repo.</li>
            <li>Permissions → Repository permissions → <b>Contents: Read and write</b>.</li>
            <li>Generate, copy the token and paste it below. It is stored only in this browser. Never share it.</li>
          </ol>
          <div className="row"><input type="password" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Paste token (github_pat_…)" aria-label="GitHub token" autoComplete="off" /><button className="btn g" disabled={!draft.trim()} onClick={() => { setToken(draft); setTok(draft.trim()); setDraft(''); }}>Save</button></div>
        </details>
      ) : (
        <div className="row" style={{ marginTop: 12 }}><button className="btn" disabled={busy} onClick={publish}>{busy ? 'Publishing…' : 'Publish to website'}</button><button className="btn g" onClick={() => { clearToken(); setTok(''); setMsg(null); }}>Remove token</button></div>
      )}
      {msg && <div className={msg.ok ? 'pos' : 'err'} style={{ marginTop: 10, fontSize: 13 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.message}{msg.ok && (pubPass ? ' 🔒 Encrypted for members.' : ' 🌐 Public.')}</div>}
      <details style={{ marginTop: 14 }}><summary>Manual option & backup</summary>
        <div className="row" style={{ marginTop: 10, flexWrap: 'wrap', justifyContent: 'flex-start' }}><button className="btn g" onClick={copy}>{copied ? 'Copied ✓' : 'Copy data JSON'}</button><button className="btn g" onClick={dl}>Download data.json</button>
          <button className="btn g" onClick={() => { if (confirm('Erase the data saved in this browser? (The published data.json, if any, will load instead.)')) { resetDb(); location.reload(); } }}>Erase local data</button></div>
        <div className="sub" style={{ marginTop: 8 }}>Manual publishing: paste the copied JSON into <b>public/{clan.file}</b> on GitHub and commit.</div>
      </details>
      <button className="btn g" style={{ marginTop: 14 }} onClick={onLock}>🔒 Lock this page</button>
    </Card>);
}

/** Firebase mode: publishing writes this clan's data to Firestore. No GitHub token is needed. */
function CloudPublish({ onLock }) {
  const clan = useClan(), user = getUser(), [busy, setBusy] = useState(false), [msg, setMsg] = useState(null);
  const text = exportCompact(), kb = Math.round(new Blob([text]).size / 1024);
  const publish = async () => {
    setBusy(true); setMsg(null);
    const r = await cloudPublish(clan.id, text);
    setMsg(r.ok ? { ok: true, message: 'Published to Firebase. Approved members see the new data straight away.' }
      : { ok: false, message: r.denied ? `Firebase refused this. You are signed in as ${user?.email}; only the admin Gmail written in your Firestore rules can publish.` : r.message });
    setBusy(false);
  };
  return (
    <Card title="Publish to Firebase" sub={`Imports are saved only in this browser until you publish. Publishing saves ${CLANS.length > 1 ? clan.name + "'s data" : 'the data'} to Firebase, where only its approved members can read it.`}>
      <div className="stats" style={{ marginTop: 12 }}>
        <div className="stat"><span>Signed in as</span><b style={{ fontSize: 14, overflowWrap: 'anywhere' }}>{user?.email || '—'}</b></div>
        <div className="stat"><span>Data size</span><b style={{ fontSize: 18 }}>{kb} KB</b><small>limit 1,000 KB per clan</small></div>
      </div>
      {kb > 800 && <div className="err">⚠ This clan's data is getting close to the 1,000 KB limit. Tell your developer to split or compress it.</div>}
      <div className="row" style={{ marginTop: 12 }}><button className="btn" disabled={busy} onClick={publish}>{busy ? 'Publishing…' : 'Publish to Firebase'}</button><button className="btn g" onClick={onLock}>Sign out</button></div>
      {msg && <div className={msg.ok ? 'pos' : 'err'} style={{ marginTop: 10, fontSize: 13 }}>{msg.ok ? '✓ ' : '⚠ '}{msg.message}</div>}
    </Card>);
}

export default function Admin({ onLock }) {
  const db = useDb(), clan = useClan(), [form, setForm] = useState(null);
  if (form) return <WeekForm initial={form === 'new' ? null : form} onDone={() => setForm(null)} />;
  const del = w => { const n = weekRows(db, 'pr', w.id).length + weekRows(db, 'sr', w.id).length; if (confirm(`Delete Week ${w.weekNumber} and ALL ${n} scores in it (PR and SR)? You can undo this right after.`)) deleteWeek(w.id); };
  const delEvent = (w, k, n) => { if (confirm(`Delete only the ${n} ${k.toUpperCase()} scores of Week ${w.weekNumber}? The ${k === 'pr' ? 'SR' : 'PR'} scores stay. You can undo this right after.`)) deleteWeekEvent(w.id, k); };
  const undo = getUndo(), ago = undo && Math.max(1, Math.round((Date.now() - undo.at) / 60000));
  return (<>
    {undo && <div className="note" style={{ borderLeftColor: 'var(--acc)' }}><div className="row"><span><b>Undo available:</b> {undo.label} <span className="sub">({ago} min ago)</span></span>
      <button className="btn" onClick={() => { if (confirm(`Undo "${undo.label}"?\n\nThis restores everything to how it was just before it, and also reverts anything you changed since. Publish again afterwards if you had already published.`)) undoLast(); }}>↶ Undo</button></div></div>}
    {CLANS.length > 1 && <div className="note">You are managing the data of <b>{clan.name}</b>. Imports, deletes and publishing here affect only this clan. Use the clan tabs at the top to switch.</div>}
    <Import />
    <Card title="Weeks" sub={db.weeks.length ? 'Edit fixes scores. Delete PR / Delete SR removes just that sheet; Delete week removes both. Every delete can be undone.' : 'No weeks yet. Import a CSV above.'} right={<button className="btn g" onClick={() => setForm('new')}>+ Add manually</button>}>
      {db.weeks.length > 0 && <div className="bd">{weeksDesc(db).map(w => { const pr = weekRows(db, 'pr', w.id).length, sr = weekRows(db, 'sr', w.id).length; return (
        <div key={w.id} className="lr" style={{ gridTemplateColumns: '1fr', gap: 8 }}>
          <span>{weekLabel(w)}<div className="sub">{pr} PR · {sr} SR</div></span>
          <div className="row" style={{ justifyContent: 'flex-start', flexWrap: 'wrap', gap: 6 }}>
            <button className="btn g" onClick={() => setForm(w)}>Edit</button>
            {pr > 0 && <button className="btn g red" onClick={() => delEvent(w, 'pr', pr)}>Delete PR</button>}
            {sr > 0 && <button className="btn g red" onClick={() => delEvent(w, 'sr', sr)}>Delete SR</button>}
            <button className="btn g red" aria-label={`Delete week ${w.weekNumber}`} onClick={() => del(w)}>Delete week</button>
          </div>
        </div>); })}</div>}
    </Card>
    {krMonths(db).length > 0 && <Card title="Kraken months" sub="Delete a month if you imported the wrong file, then import it again.">
      <div className="bd">{[...krMonths(db)].reverse().map(m => { const rows = krMonthRows(db, m), dmg = rows.reduce((t, r) => t + r.damage, 0); return <div key={m} className="lr" style={{ gridTemplateColumns: '1fr auto' }}><span>{monthLabel(m)}<div className="sub">{rows.length} players · {fmtDmg(dmg)} damage</div></span>
        <button className="btn g" style={{ color: 'var(--red)' }} aria-label={`Delete Kraken ${monthLabel(m)}`} onClick={() => { if (confirm(`Delete Kraken ${monthLabel(m)} (${rows.length} rows)? This cannot be undone.`)) deleteKrakenMonth(m); }}>✕</button></div>; })}</div>
    </Card>}
    <Players />
    {cloudEnabled && <Members />}
    {cloudEnabled ? <CloudPublish onLock={onLock} /> : <Publish onLock={onLock} />}
  </>);
}
