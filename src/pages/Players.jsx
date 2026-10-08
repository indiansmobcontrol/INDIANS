import React, { useState } from 'react';
import { Card, Stat, Avatar, Line, useDb } from '../components/ui.jsx';
import { useClan } from '../clanContext.js';
import { player, history, playerStats, rating, weeksAsc, krHistory } from '../services/stats.js';
import { fmt, fmtAxis, shortDate, fmtDmg, fmtSparks, monthLabel } from '../utils/format.js';

export function PlayerList() {
  const db = useDb(), { href } = useClan(), [q, setQ] = useState('');
  const list = db.players.filter(p => p.name.toLowerCase().includes(q.trim().toLowerCase()))
    .map(p => ({ p, r: rating(db, p.id), pr: playerStats(db, 'pr', p.id), sr: playerStats(db, 'sr', p.id) })).sort((a, b) => b.r - a.r || a.p.name.localeCompare(b.p.name));
  return (<>
    <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${db.players.length} players…`} aria-label="Search player" />
    <div className="g2">
      {list.map(({ p, r, pr, sr }) => (
        <a key={p.id} href={href('players/' + p.id)} className="card pcard">
          <div className="row"><div className="row" style={{ justifyContent: 'flex-start', minWidth: 0 }}><Avatar name={p.name} status={p.status} /><b className="nm">{p.name}</b></div><span className="big" style={{ margin: 0, fontSize: 22 }}>{r.toFixed(2)}</span></div>
          <div className="stats" style={{ marginTop: 10 }}><Stat label="Piggy best" value={pr ? fmt('pr', pr.highest) : '—'} /><Stat label="Space best" value={sr ? fmt('sr', sr.highest) : '—'} /></div>
        </a>
      ))}
    </div>
    {!list.length && <div className="sub">{db.players.length ? `No players match “${q}”.` : 'No players yet.'}</div>}
  </>);
}

const History = ({ k, h }) => (
  <div className="scroll"><table className="tbl"><thead><tr><th>WEEK</th><th>DATES</th><th>SCORE</th><th>RANK</th></tr></thead>
    <tbody>{[...h].reverse().map(({ week, row }) => <tr key={week.id}><td>Week {week.weekNumber}</td><td>{shortDate(week.startDate)}</td><td><b>{fmt(k, row.score)}</b></td><td>#{row.rank}</td></tr>)}</tbody></table></div>
);

function KrakenCard({ db, id }) {
  const h = krHistory(db, id);
  if (!h.length) return null;
  const dmg = h.reduce((s, x) => s + x.row.damage, 0), sp = h.reduce((s, x) => s + x.row.sparks, 0);
  return (
    <Card title="Kraken · monthly" sub="Damage and sparks by month">
      <div className="stats" style={{ marginTop: 10 }}><Stat label="Total damage" value={fmtDmg(dmg)} /><Stat label="Total sparks" value={fmtSparks(sp)} /><Stat label="Best rank" value={'#' + Math.min(...h.map(x => x.row.rank))} /><Stat label="Months" value={h.length} /></div>
      <div className="scroll"><table className="tbl"><thead><tr><th>MONTH</th><th>RANK</th><th>DAMAGE</th><th>SPARKS</th></tr></thead>
        <tbody>{[...h].reverse().map(x => <tr key={x.monthId}><td>{monthLabel(x.monthId)}</td><td>#{x.row.rank}</td><td><b>{fmtDmg(x.row.damage)}</b></td><td>{fmtSparks(x.row.sparks)}</td></tr>)}</tbody></table></div>
    </Card>
  );
}

export function Profile({ id, go }) {
  const db = useDb(), p = player(db, id);
  if (!p) return <Card title="Player not found" sub="They may have been removed or marked as left."><button className="btn" style={{ marginTop: 12 }} onClick={() => go('players')}>Back to players</button></Card>;
  const ws = weeksAsc(db), labels = ws.map(w => 'W' + w.weekNumber);
  return (<>
    <div><button className="btn g" onClick={() => go('players')}>← All players</button></div>
    <Card>
      <div className="row"><div className="row" style={{ justifyContent: 'flex-start', minWidth: 0 }}><Avatar name={p.name} status={p.status} big /><div style={{ minWidth: 0 }}><h2 style={{ fontSize: 20, overflowWrap: 'anywhere' }}>{p.name}</h2><span className={'bdg ' + p.status}>{p.status}</span></div></div>
        <button className="btn g" onClick={() => go('trends?p=' + p.id)}>Compare in Trends</button></div>
      <div className="stats" style={{ marginTop: 14 }}><Stat label="Player rating" value={rating(db, p.id).toFixed(2)} /><Stat label="Weeks logged" value={new Set([...history(db, 'pr', p.id), ...history(db, 'sr', p.id)].map(x => x.week.id)).size} /></div>
    </Card>
    {['pr', 'sr'].map(k => {
      const h = history(db, k, p.id), s = playerStats(db, k, p.id), name = k === 'pr' ? 'Piggy Race' : 'Space Race';
      return (
        <div key={k} className="g2">
          <Card title={`${k.toUpperCase()} · All-time performance`} sub={name}>
            {s ? <div className="stats" style={{ marginTop: 10 }}><Stat label="Total" value={fmt(k, s.total)} /><Stat label="Average" value={fmt(k, s.avg)} /><Stat label="Highest" value={fmt(k, s.highest)} /><Stat label="Best rank" value={'#' + s.bestRank} /><Stat label="Weeks" value={s.weeks} /><Stat label="Latest" value={fmt(k, s.latest)} /></div> : <div className="sub" style={{ marginTop: 10 }}>No {k.toUpperCase()} scores yet.</div>}
          </Card>
          <Card title={`${name} history`} sub="Score by week">
            <Line series={[{ data: ws.map(w => h.find(x => x.week.id === w.id)?.row.score ?? null), color: k === 'pr' ? 'var(--c-pr)' : 'var(--c-sr)' }]} labels={labels} fmtY={v => fmtAxis(k, v)} />
            {h.length > 0 && <History k={k} h={h} />}
          </Card>
        </div>
      );
    })}
    <KrakenCard db={db} id={p.id} />
  </>);
}
