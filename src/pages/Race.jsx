import React, { useState } from 'react';
import { Card, Tabs, WeekPicker, Board, EmptyData, useDb } from '../components/ui.jsx';
import { weeksDesc, weekRows, averages, compareWithAvg, latestWeekFor, player } from '../services/stats.js';
import { fmt, fmtDelta, fmtPct } from '../utils/format.js';
import { boardRows } from '../utils/rows.js';

const META = {
  pr: { name: 'Piggy Race', overall: 'Overall Piggy Performance', unit: 'Average score across all tracked weeks' },
  sr: { name: 'Space Race', overall: 'Overall Space Performance', unit: 'Average score across all tracked weeks' },
};
const tone = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');

function Compare({ db, k, go }) {
  const ws = weeksDesc(db).filter(w => weekRows(db, k, w.id).length);
  const [wa, setWa] = useState(ws[1]?.id || ws[0]?.id || ''), [wb, setWb] = useState(ws[0]?.id || '');
  const A = db.weeks.find(w => w.id === wa), B = db.weeks.find(w => w.id === wb);
  const rows = A && B ? compareWithAvg(db, k, wa, wb).filter(r => player(db, r.playerId)) : [];
  const up = rows.filter(r => r.change > 0).length, down = rows.filter(r => r.change < 0).length;
  return (
    <Card title="Week vs Week" sub="Change is calculated from the stored weekly scores. AVG is each player's average over all weeks.">
      <div className="g2" style={{ marginTop: 10, gap: 8 }}>
        <div><div className="up" style={{ marginBottom: 4 }}>Compare from</div><WeekPicker k={k} value={wa} onChange={setWa} label="From week" /></div>
        <div><div className="up" style={{ marginBottom: 4 }}>To (current)</div><WeekPicker k={k} value={wb} onChange={setWb} label="To week" /></div>
      </div>
      {A && B && <div className="sub" style={{ margin: '10px 0 4px' }}><span className="pos">▲ {up} up</span> · <span className="neg">▼ {down} down</span> · {rows.length} players</div>}
      <div className="scroll" style={{ margin: '0 -14px -14px', borderTop: '1px solid var(--line)', maxHeight: '64vh', overflowY: 'auto' }}>
        <table className="tbl stk">
          <thead><tr><th>PLAYER</th><th>{A ? 'WK ' + A.weekNumber : 'FROM'}</th><th>{B ? 'WK ' + B.weekNumber : 'TO'}</th><th>CHANGE</th><th>AVG</th><th>VS AVG</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.playerId}>
                <td><button className="lnk" onClick={() => go('players/' + r.playerId)}>{player(db, r.playerId).name}</button></td>
                <td>{r.a != null ? fmt(k, r.a) : '—'}</td>
                <td><b>{r.b != null ? fmt(k, r.b) : '—'}</b></td>
                <td className={tone(r.change)}>{r.change == null ? '—' : <>{fmtDelta(k, r.change)}<small>{fmtPct(r.changePct)}</small></>}</td>
                <td>{r.avg != null ? fmt(k, r.avg) : '—'}</td>
                <td className={tone(r.vsAvg)}>{r.vsAvg == null ? '—' : <>{fmtDelta(k, r.vsAvg)}<small>{fmtPct(r.vsAvgPct)}</small></>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan="6" style={{ textAlign: 'center' }} className="sub">Pick two weeks that have scores.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function Race({ k, go, params }) {
  const db = useDb(), m = META[k];
  const [tab, setTab] = useState(params.get('tab') || 'overall');
  const [wk, setWk] = useState(params.get('week') || latestWeekFor(db, k)?.id || '');
  if (!weeksDesc(db).length) return <EmptyData />;
  const open = id => go('players/' + id), W = db.weeks.find(w => w.id === wk);
  return (<>
    <Tabs items={[['overall', 'Overall'], ['event', 'Event'], ['compare', 'Compare']]} value={tab} onChange={setTab} />
    {tab === 'overall' && <Card title={m.overall} sub={m.unit}><Board rows={boardRows(db, k, averages(db, k))} valueLabel="AVG" onOpen={open} /></Card>}
    {tab === 'event' && (<>
      <WeekPicker k={k} value={wk} onChange={setWk} />
      <Card title={`${m.name}${W ? ` — Week ${W.weekNumber}` : ''}`} sub={`${weekRows(db, k, wk).length} players in this week`}><Board rows={boardRows(db, k, weekRows(db, k, wk))} onOpen={open} /></Card>
    </>)}
    {tab === 'compare' && <Compare db={db} k={k} go={go} />}
  </>);
}
