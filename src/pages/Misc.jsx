import React, { useState } from 'react';
import { Card, Tabs, Line, Board, EmptyData, useDb } from '../components/ui.jsx';
import { player, history, weeksAsc, records, krRecords, rating } from '../services/stats.js';
import { fmt, fmtAxis, fmtDmg, fmtSparks, monthLabel } from '../utils/format.js';

export function Records({ go }) {
  const db = useDb(), [k, setK] = useState('pr');
  const rows = k === 'kr'
    ? krRecords(db).map(r => { const p = player(db, r.playerId); return p && { rank: r.rank, playerId: p.id, name: p.name, status: p.status, value: fmtDmg(r.damage), sub: `${monthLabel(r.monthId)} · ${fmtSparks(r.sparks)} sparks` }; }).filter(Boolean)
    : records(db, k).map(r => { const p = player(db, r.playerId); return { rank: r.rank, playerId: r.playerId, name: p.name, status: p.status, value: fmt(k, r.score), sub: `Week ${r.week.weekNumber}` }; });
  const title = { pr: 'Piggy Race Records', sr: 'Space Race Records', kr: 'Kraken Records' }[k];
  return (<>
    <Tabs items={[['pr', 'PR'], ['sr', 'SR'], ['kr', 'Kraken']]} value={k} onChange={setK} />
    <Card title={title} sub={k === 'kr' ? "Each player's highest single-month damage, all time" : "Each player's highest weekly score, all time"}>
      <Board rows={rows} valueLabel="RECORD" onOpen={id => go('players/' + id)} />
    </Card>
  </>);
}

export function Ratings({ go }) {
  const db = useDb();
  const rows = db.players.map(p => ({ playerId: p.id, name: p.name, status: p.status, v: rating(db, p.id) })).filter(r => r.v > 0).sort((a, b) => b.v - a.v).map((r, i) => ({ ...r, rank: i + 1, value: r.v.toFixed(2) }));
  return <Card title="Player Ratings" sub="Out of 6.00: each score as a share of that week's leader, averaged over PR and SR"><Board rows={rows} valueLabel="RATING" onOpen={id => go('players/' + id)} /></Card>;
}

export function Trends({ params }) {
  const db = useDb(), ps = [...db.players].sort((x, y) => x.name.localeCompare(y.name));
  const [a, setA] = useState(params.get('p') || ps[0]?.id || ''), [b, setB] = useState(ps.find(p => p.id !== (params.get('p') || ps[0]?.id))?.id || '');
  if (!db.players.length) return <EmptyData />;
  const ws = weeksAsc(db), line = (k, id) => ws.map(w => history(db, k, id).find(x => x.week.id === w.id)?.row.score ?? null);
  const Pick = ({ v, set, label }) => <select value={v} onChange={e => set(e.target.value)} aria-label={label}>{ps.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>;
  return (<>
    <Card title="Compare players" sub="Pick two players to overlay their weekly scores.">
      <div className="g2" style={{ marginTop: 10, gap: 8 }}><Pick v={a} set={setA} label="First player" /><Pick v={b} set={setB} label="Second player" /></div>
      <div className="legend"><span><i style={{ background: 'var(--c-a)' }} />{player(db, a)?.name}</span><span><i style={{ background: 'var(--c-b)' }} />{player(db, b)?.name}</span></div>
    </Card>
    {['pr', 'sr'].map(k => (
      <Card key={k} title={k === 'pr' ? 'Piggy Race' : 'Space Race'} sub="Score by week">
        <Line labels={ws.map(w => 'W' + w.weekNumber)} fmtY={v => fmtAxis(k, v)} series={[{ data: line(k, a), color: 'var(--c-a)' }, { data: line(k, b), color: 'var(--c-b)' }]} />
      </Card>
    ))}
  </>);
}
