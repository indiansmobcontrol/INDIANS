import React, { useState } from 'react';
import { useClan } from '../clanContext.js';
import { Card, Stat, Tabs, Line, Board, EmptyData, Wordmark, useDb } from '../components/ui.jsx';
import { weeksDesc, weeksAsc, weekRows, weeklyAvg, bestRecord, latestWeekFor, player, rating, krRecords, krMonths, krTotals } from '../services/stats.js';
import { fmt, fmtAxis, weekLabel, fmtDmg, fmtSparks, monthShort } from '../utils/format.js';
import { boardRows } from '../utils/rows.js';

function Explorer({ go }) {
  const db = useDb(), { name } = useClan(), [q, setQ] = useState(''), t = q.trim().toLowerCase();
  const hit = t && (db.players.find(p => p.name.toLowerCase() === t) || db.players.find(p => p.name.toLowerCase().includes(t)));
  return (
    <Card>
      <div className="up" style={{ color: 'var(--tx)', fontSize: 14 }}>Player Explorer</div>
      <div className="sub">Jump straight to any {name} player profile.</div>
      <input list="players-list" value={q} onChange={e => setQ(e.target.value)} placeholder="Search player…" aria-label="Search player" style={{ marginTop: 10 }} onKeyDown={e => e.key === 'Enter' && hit && go('players/' + hit.id)} />
      <datalist id="players-list">{db.players.map(p => <option key={p.id} value={p.name} />)}</datalist>
      <button className="btn" style={{ marginTop: 10 }} disabled={!hit} onClick={() => go('players/' + hit.id)}>Open profile</button>
    </Card>
  );
}

function Latest({ db, k, title, route, go }) {
  const w = latestWeekFor(db, k);
  if (!w) return <Card title={title} sub="No scores yet." />;
  const rows = weekRows(db, k, w.id);
  return (
    <Card title={title} sub={`${weekLabel(w)} · ${rows.length} players`}>
      <Board scroll={false} rows={boardRows(db, k, rows.slice(0, 10))} onOpen={id => go('players/' + id)} />
      {rows.length > 10 && <button className="btn g" style={{ width: '100%', marginTop: 24 }} onClick={() => go(`${route}?tab=event&week=${w.id}`)}>View all {rows.length} players →</button>}
    </Card>
  );
}

export default function Overview({ go }) {
  const db = useDb(), [k, setK] = useState('pr');
  const latest = weeksDesc(db)[0];
  if (!latest) return (<><Explorer go={go} /><EmptyData /></>);

  const nameOf = r => player(db, r.playerId)?.name || '—';
  const prRec = bestRecord(db, 'pr'), srRec = bestRecord(db, 'sr');
  const recSub = r => (r ? `${nameOf(r)} · Wk ${r.week.weekNumber}` : 'No data yet');
  const krRec = krRecords(db)[0], krLast = krMonths(db).at(-1), krT = krLast && krTotals(db, krLast);
  const active = db.players.filter(p => p.status === 'Active').length;
  const trend = weeklyAvg(db, k).filter(t => t.value != null).slice(-8);
  const last4 = weeksAsc(db).slice(-4), avgs = { pr: weeklyAvg(db, 'pr'), sr: weeklyAvg(db, 'sr') };
  const top = db.players.map(p => ({ playerId: p.id, name: p.name, status: p.status, v: rating(db, p.id) })).filter(r => r.v > 0).sort((a, b) => b.v - a.v).slice(0, 8).map((r, i) => ({ ...r, rank: i + 1, value: r.v.toFixed(2) }));

  return (<>
    <Explorer go={go} />
    <Card className="hero">
      <Wordmark size={34} bar />
      <h2>Clan Intelligence Dashboard</h2>
      <div className="sub">Live view of the roster, weekly trends and event leaders.</div>
      <div className="sub" style={{ marginTop: 10 }}><span className="pos">●</span> Latest data: {weekLabel(latest)}</div>
    </Card>
    <div className={krRec ? 'stats s3' : 'stats s4'}>
      <Stat label="Current roster" value={active} sub={`${db.players.length} players tracked`} />
      <Stat label="Weeks tracked" value={db.weeks.length} sub={`Latest: Week ${latest.weekNumber}`} />
      <Stat label="Piggy record" value={prRec ? fmt('pr', prRec.score) : '—'} sub={recSub(prRec)} />
      <Stat label="Space record" value={srRec ? fmt('sr', srRec.score) : '—'} sub={recSub(srRec)} />
      {krRec && <Stat label="Kraken record" value={fmtDmg(krRec.damage)} sub={`${player(db, krRec.playerId)?.name || '—'} · ${monthShort(krRec.monthId)}`} />}
      {krT && <Stat label={`Kraken · ${monthShort(krLast)}`} value={fmtDmg(krT.damage)} sub={`${fmtSparks(krT.sparks)} sparks · ${krT.players} players`} />}
    </div>
    <Card title="Weekly Performance" sub="Average score per participant" right={<div style={{ width: 120 }}><Tabs items={[['pr', 'PR'], ['sr', 'SR']]} value={k} onChange={setK} /></div>}>
      <Line series={[{ data: trend.map(t => t.value), color: k === 'pr' ? 'var(--c-pr)' : 'var(--c-sr)' }]} labels={trend.map(t => 'W' + t.week.weekNumber)} fmtY={v => fmtAxis(k, v)} />
      <div className="scroll"><table className="tbl"><thead><tr><th />{last4.map(w => <th key={w.id}>WEEK {w.weekNumber}</th>)}</tr></thead>
        <tbody>{['pr', 'sr'].map(m => <tr key={m}><td>{m.toUpperCase()}</td>{last4.map(w => { const v = avgs[m].find(x => x.week.id === w.id)?.value; return <td key={w.id}>{v == null ? '—' : fmt(m, v)}</td>; })}</tr>)}</tbody></table></div>
    </Card>
    <div className="g2">
      <Latest db={db} k="pr" title="Latest Piggy" route="piggy" go={go} />
      <Latest db={db} k="sr" title="Latest Space" route="space" go={go} />
    </div>
    <Card title="Top Rated Players" sub="Rating out of 6.00: how close a player is to each week's leader (PR and SR)">
      <Board rows={top} valueLabel="RATING" onOpen={id => go('players/' + id)} />
    </Card>
  </>);
}
