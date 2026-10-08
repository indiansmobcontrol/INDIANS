import React, { useEffect, useId, useState } from 'react';
import { subscribe, getDb, getPublishInfo } from '../services/db.js';
import { isAdmin } from '../services/admin.js';
import { useClan } from '../clanContext.js';
import { initials, weekShort, monthLabel } from '../utils/format.js';
import { weeksDesc, weekRows, krMonths } from '../services/stats.js';

export function useDb() {
  const [db, set] = useState(getDb());
  useEffect(() => subscribe(() => set(getDb())), []);
  return db;
}

/** The clan name, styled. */
export const Wordmark = ({ size = 20, bar = false }) => {
  const { name } = useClan();
  return <span className="wmw"><span className="wm" style={{ fontSize: size }}>{name}</span>{bar && <i className="wm-bar" />}</span>;
};
export const Emblem = ({ size = 46 }) => (
  <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className="emblem">
    <defs><linearGradient id="embg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={{ stopColor: 'var(--wm1)' }} /><stop offset="0.5" style={{ stopColor: 'var(--wm2)' }} /><stop offset="1" style={{ stopColor: 'var(--wm3)' }} /></linearGradient></defs>
    <path d="M24 3 42 10v13c0 11-8 19-18 22C14 42 6 34 6 23V10z" style={{ fill: 'var(--card)', stroke: 'url(#embg)' }} strokeWidth="2.5" />
    <path d="M17 15h14v4h-5v10h5v4H17v-4h5V19h-5z" fill="url(#embg)" />
  </svg>
);

export const Card = ({ title, sub, right, children, className = '' }) => (
  <section className={'card ' + className}>
    {(title || right) && <div className="row"><div style={{ minWidth: 0 }}><h2>{title}</h2>{sub && <div className="sub">{sub}</div>}</div>{right}</div>}
    {children}
  </section>
);
export const Empty = ({ title, sub, action }) => (
  <Card title={title} sub={sub}>{action && <button className="btn" style={{ marginTop: 12 }} onClick={action.onClick}>{action.label}</button>}</Card>
);
/** Shown on every page when there is no data. Tells owner and visitors apart and says what was found. */
export function EmptyData() {
  const { prefix } = useClan();
  return (
    <Card title="No data yet" sub={isAdmin() ? 'Import your first CSV on the Data page, then publish it.' : "The clan hasn't published any scores yet. Check back soon."}>
      {isAdmin() && <button className="btn" style={{ marginTop: 12 }} onClick={() => { location.hash = '/' + prefix + 'admin'; }}>Go to Data</button>}
      <div className="sub" style={{ marginTop: 12 }}>Published data: {getPublishInfo()}</div>
    </Card>
  );
}
export const Stat = ({ label, value, sub }) => <div className="stat"><span>{label}</span><b>{value}</b>{sub && <small>{sub}</small>}</div>;
export const Avatar = ({ name, status, big }) => (
  <span className={'av' + (big ? ' l' : '')}>{initials(name)}{status && <i className={'sd ' + status} title={status} />}</span>
);
export const Status = ({ s }) => <span className={'bdg ' + s}>{s}</span>;
export const Tabs = ({ items, value, onChange }) => (
  <div className="tabs" role="tablist">{items.map(([k, l]) => <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}</div>
);

/** Prev / dropdown / next week selector. Pass k ('pr'|'sr') to list only weeks that have that event. */
export function WeekPicker({ value, onChange, k, label }) {
  const db = useDb(), all = weeksDesc(db), ws = k ? all.filter(w => weekRows(db, k, w.id).length) : all, list = ws.length ? ws : all;
  const i = list.findIndex(w => w.id === value);
  return (
    <div className="row wp" style={{ gap: 6 }}>
      <button className="btn g" aria-label={`${label || 'Week'}: older`} disabled={i < 0 || i >= list.length - 1} onClick={() => onChange(list[i + 1].id)}>←</button>
      <select value={list.some(w => w.id === value) ? value : ''} onChange={e => onChange(e.target.value)} aria-label={label || 'Select week'}>
        {!list.some(w => w.id === value) && <option value="">Select week</option>}
        {list.map(w => <option key={w.id} value={w.id}>{weekShort(w)}</option>)}
      </select>
      <button className="btn g" aria-label={`${label || 'Week'}: newer`} disabled={i <= 0} onClick={() => onChange(list[i - 1].id)}>→</button>
    </div>
  );
}

/** Prev / dropdown / next month selector for Kraken (only months that have data). */
export function MonthPicker({ value, onChange, label }) {
  const db = useDb(), list = krMonths(db).reverse(), i = list.indexOf(value);
  return (
    <div className="row wp" style={{ gap: 6 }}>
      <button className="btn g" aria-label={`${label || 'Month'}: older`} disabled={i < 0 || i >= list.length - 1} onClick={() => onChange(list[i + 1])}>←</button>
      <select value={list.includes(value) ? value : ''} onChange={e => onChange(e.target.value)} aria-label={label || 'Select month'}>
        {!list.includes(value) && <option value="">Select month</option>}
        {list.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
      </select>
      <button className="btn g" aria-label={`${label || 'Month'}: newer`} disabled={i <= 0} onClick={() => onChange(list[i - 1])}>→</button>
    </div>
  );
}

/** Ranked list. rows: [{rank, playerId, name, status, value, sub?}] */
export function Board({ rows, onOpen, valueLabel = 'SCORE', scroll = true }) {
  const open = id => onOpen?.(id);
  return (
    <div className={scroll ? 'bd' : 'bd flat'}>
      <div className="lr h"><span>#</span><span>MEMBER</span><span style={{ textAlign: 'right' }}>{valueLabel}</span></div>
      {rows.map(r => (
        <div key={r.playerId} className={'lr' + (onOpen ? ' link' : '')} onClick={() => open(r.playerId)} role={onOpen ? 'link' : undefined} tabIndex={onOpen ? 0 : undefined} onKeyDown={e => e.key === 'Enter' && open(r.playerId)}>
          <span className={'rk' + (r.rank <= 3 ? ' t' + r.rank : '')}>{r.rank}</span>
          <span className="m"><Avatar name={r.name} status={r.status} /><span className="nm">{r.name}{r.sub && <small>{r.sub}</small>}</span></span>
          <span className="v">{r.value}</span>
        </div>
      ))}
      {!rows.length && <div className="lr"><span /><span className="sub">No data for this selection.</span><span /></div>}
    </div>
  );
}

/** Dependency-free SVG line chart. series: [{data:[number|null], color:'var(--c-pr)'}] */
export function Line({ series, labels, fmtY = v => v, h = 170 }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const W = 320, p = 30, vals = series.flatMap(s => s.data).filter(v => v != null);
  if (!vals.length) return <div className="sub" style={{ padding: '18px 0' }}>No data yet.</div>;
  const lo = Math.min(...vals), hi = Math.max(...vals), sp = hi - lo || 1;
  const x = i => p + (labels.length < 2 ? (W - 2 * p) / 2 : (i * (W - 2 * p)) / (labels.length - 1));
  const y = v => h - 22 - ((v - lo) / sp) * (h - 46);
  const path = d => d.map((v, i) => (v == null ? '' : (i === 0 || d[i - 1] == null ? 'M' : 'L') + x(i).toFixed(1) + ' ' + y(v).toFixed(1))).join(' ');
  const solo = series.length === 1 ? series[0] : null, first = solo && solo.data.findIndex(v => v != null), last = solo && solo.data.length - 1 - [...solo.data].reverse().findIndex(v => v != null);
  return (
    <svg viewBox={`0 0 ${W} ${h}`} width="100%" role="img" aria-label="Trend chart" className="chart">
      <defs>{solo && <linearGradient id={'g' + uid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: solo.color, stopOpacity: 0.32 }} /><stop offset="1" style={{ stopColor: solo.color, stopOpacity: 0 }} /></linearGradient>}</defs>
      {[0, 0.5, 1].map(t => <line key={t} x1={p} x2={W - p} y1={y(lo + sp * t)} y2={y(lo + sp * t)} className="grid" />)}
      <text x="2" y={y(hi) + 3}>{fmtY(hi)}</text><text x="2" y={y(lo) + 3}>{fmtY(lo)}</text>
      {solo && first >= 0 && <path d={path(solo.data) + ` L${x(last).toFixed(1)} ${h - 22} L${x(first).toFixed(1)} ${h - 22}Z`} fill={`url(#g${uid})`} stroke="none" />}
      {series.map((s, si) => <g key={si}><path d={path(s.data)} fill="none" style={{ stroke: s.color }} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />{s.data.map((v, i) => v != null && <circle key={i} cx={x(i)} cy={y(v)} r="3.4" className="dot" style={{ stroke: s.color }} strokeWidth="2" />)}</g>)}
      {labels.map((l, i) => <text key={i} x={x(i)} y={h - 5} textAnchor="middle">{l}</text>)}
    </svg>
  );
}
