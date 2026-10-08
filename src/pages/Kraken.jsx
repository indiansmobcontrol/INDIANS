import React, { useState } from 'react';
import { Card, Stat, Tabs, Line, Board, MonthPicker, useDb } from '../components/ui.jsx';
import { isAdmin } from '../services/admin.js';
import { player, krMonths, krMonthRows, krTotals, krCompare } from '../services/stats.js';
import { fmtDmg, fmtDmgDelta, fmtSparks, fmtSparksDelta, fmtPct, pct, monthLabel, monthShort } from '../utils/format.js';

const tone = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');
const big = s => <span className={String(s).length > 11 ? 'sm' : ''}>{s}</span>;
/** Month header for the compare table: "AUG", or "AUG 25" when the two months are in different years. */
const mon = (id, withYear) => monthLabel(id).slice(0, 3).toUpperCase() + (withYear ? " '" + id.slice(2, 4) : '');
const vs = (cur, prev, label) => (prev == null ? <>First month tracked</> : <span className={tone(cur - prev)}>{fmtPct(pct(prev, cur))} vs {label}</span>);

function MonthTab({ db, go }) {
  const months = krMonths(db).reverse();
  const [m, setM] = useState(months[0]), [metric, setMetric] = useState('damage');
  const prev = months[months.indexOf(m) + 1], t = krTotals(db, m), pt = prev ? krTotals(db, prev) : null;
  let rows = krMonthRows(db, m).filter(r => player(db, r.playerId));
  if (metric === 'sparks') rows = [...rows].sort((a, b) => b.sparks - a.sparks || b.damage - a.damage).map((r, i) => ({ ...r, rank: i + 1 }));
  const board = rows.map(r => { const p = player(db, r.playerId); return { rank: r.rank, playerId: p.id, name: p.name, status: p.status, value: metric === 'damage' ? fmtDmg(r.damage) : fmtSparks(r.sparks), sub: metric === 'damage' ? `${fmtSparks(r.sparks)} sparks` : `${fmtDmg(r.damage)} damage` }; });
  const top = t.top && player(db, t.top.playerId);
  return (<>
    <MonthPicker value={m} onChange={setM} />
    <div className="stats s4">
      <Stat label="Clan total damage" value={big(fmtDmg(t.damage))} sub={vs(t.damage, pt?.damage, prev && monthShort(prev))} />
      <Stat label="Clan total sparks" value={big(fmtSparks(t.sparks))} sub={vs(t.sparks, pt?.sparks, prev && monthShort(prev))} />
      <Stat label="Players" value={t.players} sub={`Avg ${fmtDmg(t.avgDamage)} damage each`} />
      <Stat label="Top damage" value={top ? top.name : '—'} sub={t.top ? fmtDmg(t.top.damage) : ''} />
    </div>
    <Tabs items={[['damage', 'By damage'], ['sparks', 'By sparks']]} value={metric} onChange={setMetric} />
    <Card title={`Kraken · ${monthLabel(m)}`} sub={`${rows.length} players`}>
      <Board rows={board} valueLabel={metric === 'damage' ? 'DAMAGE' : 'SPARKS'} onOpen={id => go('players/' + id)} />
    </Card>
  </>);
}

function CompareTab({ db, go }) {
  const months = krMonths(db).reverse();
  const [a, setA] = useState(months[1] || months[0]), [b, setB] = useState(months[0]), [metric, setMetric] = useState('damage');
  if (months.length < 2) return <Card title="Compare months" sub="Import a second Kraken month to compare. Kraken is only compared with other Kraken months." />;
  const f = metric === 'damage' ? fmtDmg : fmtSparks, fd = metric === 'damage' ? fmtDmgDelta : fmtSparksDelta, yr = a.slice(0, 4) !== b.slice(0, 4);
  const ta = krTotals(db, a), tb = krTotals(db, b);
  const rows = krCompare(db, metric, a, b).filter(r => player(db, r.playerId));
  const up = rows.filter(r => r.change > 0).length, down = rows.filter(r => r.change < 0).length;
  const total = (label, x, y, fm, fdl) => <tr><td>{label}</td><td>{fm(x)}</td><td><b>{fm(y)}</b></td><td className={tone(y - x)}>{fdl(y - x)}<small>{fmtPct(pct(x, y))}</small></td></tr>;
  return (<>
    <Card title="Month vs month" sub="Compared only with other Kraken months.">
      <div className="g2" style={{ marginTop: 10, gap: 8 }}>
        <div><div className="up" style={{ marginBottom: 4 }}>Compare from</div><MonthPicker value={a} onChange={setA} label="From month" /></div>
        <div><div className="up" style={{ marginBottom: 4 }}>To</div><MonthPicker value={b} onChange={setB} label="To month" /></div>
      </div>
      <div className="scroll" style={{ marginTop: 10 }}><table className="tbl"><thead><tr><th>CLAN TOTAL</th><th>{mon(a, yr)}</th><th>{mon(b, yr)}</th><th>CHANGE</th></tr></thead>
        <tbody>{total('Damage', ta.damage, tb.damage, fmtDmg, fmtDmgDelta)}{total('Sparks', ta.sparks, tb.sparks, fmtSparks, fmtSparksDelta)}{total('Players', ta.players, tb.players, String, d => (d > 0 ? '+' : d < 0 ? '-' : '') + Math.abs(d))}</tbody></table></div>
    </Card>
    <Tabs items={[['damage', 'Damage'], ['sparks', 'Sparks']]} value={metric} onChange={setMetric} />
    <Card title={`Players · ${metric === 'damage' ? 'damage' : 'sparks'}`} sub="AVG is each player's average over all Kraken months. VS AVG compares the later month with it.">
      <div className="sub" style={{ margin: '10px 0 4px' }}><span className="pos">▲ {up} up</span> · <span className="neg">▼ {down} down</span> · {rows.length} players</div>
      <div className="scroll" style={{ margin: '0 -14px -14px', borderTop: '1px solid var(--line)', maxHeight: '64vh', overflowY: 'auto' }}>
        <table className="tbl stk">
          <thead><tr><th>PLAYER</th><th>{mon(a, yr)}</th><th>{mon(b, yr)}</th><th>CHANGE</th><th>AVG</th><th>VS AVG</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.playerId}>
                <td><button className="lnk" onClick={() => go('players/' + r.playerId)}>{player(db, r.playerId).name}</button></td>
                <td>{r.a != null ? f(r.a) : '—'}</td><td><b>{r.b != null ? f(r.b) : '—'}</b></td>
                <td className={tone(r.change)}>{r.change == null ? '—' : <>{fd(r.change)}<small>{fmtPct(r.changePct)}</small></>}</td>
                <td>{r.avg != null ? f(r.avg) : '—'}</td>
                <td className={tone(r.vsAvg)}>{r.vsAvg == null ? '—' : <>{fd(r.vsAvg)}<small>{fmtPct(r.vsAvgPct)}</small></>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  </>);
}

const ax = n => (n >= 1e4 ? (n / 1e6).toLocaleString('en-US', { maximumFractionDigits: n >= 1e8 ? 0 : 1 }) + 'M' : String(Math.round(n)));
function TrendTab({ db }) {
  const months = krMonths(db), ts = months.map(m => ({ m, ...krTotals(db, m) })), shown = ts.slice(-12);
  const labels = shown.map(x => monthLabel(x.m).slice(0, 3));
  return (<>
    <Card title="Clan total damage" sub="Per Kraken month"><Line series={[{ data: shown.map(x => x.damage), color: 'var(--c-a)' }]} labels={labels} fmtY={ax} /></Card>
    <Card title="Clan total sparks" sub="Per Kraken month"><Line series={[{ data: shown.map(x => x.sparks), color: 'var(--c-b)' }]} labels={labels} fmtY={ax} /></Card>
    <Card title="All Kraken months">
      <div className="scroll"><table className="tbl"><thead><tr><th>MONTH</th><th>DAMAGE</th><th>SPARKS</th><th>PLAYERS</th><th>VS PREV</th></tr></thead>
        <tbody>{[...ts].reverse().map((x, i, arr) => { const p = arr[i + 1]; return <tr key={x.m}><td>{monthShort(x.m)}</td><td><b>{fmtDmg(x.damage)}</b></td><td>{fmtSparks(x.sparks)}</td><td>{x.players}</td><td className={p ? tone(x.damage - p.damage) : ''}>{p ? fmtPct(pct(p.damage, x.damage)) : '—'}</td></tr>; })}</tbody></table></div>
    </Card>
  </>);
}

export function Kraken({ go }) {
  const db = useDb(), [tab, setTab] = useState('month');
  if (!krMonths(db).length) return (
    <Card title="No Kraken data yet" sub={isAdmin() ? 'Import a Kraken CSV on the Data page (columns: Month, Player, Rank, Dmg, Sparks), then publish it.' : "Kraken results haven't been published yet. Check back soon."}>
      {isAdmin() && <button className="btn" style={{ marginTop: 12 }} onClick={() => go('admin')}>Go to Data</button>}
    </Card>
  );
  return (<>
    <Tabs items={[['month', 'Month'], ['compare', 'Compare'], ['trend', 'Trend']]} value={tab} onChange={setTab} />
    {tab === 'month' && <MonthTab db={db} go={go} />}
    {tab === 'compare' && <CompareTab db={db} go={go} />}
    {tab === 'trend' && <TrendTab db={db} />}
  </>);
}
