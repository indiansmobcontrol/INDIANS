// Every number the site shows is derived from the weekly score tables. Nothing here is stored.
import { pct } from '../utils/format.js';
const T = { pr: 'prScores', sr: 'srScores' };
export const weeksAsc = db => [...db.weeks].sort((a, b) => (a.id < b.id ? -1 : 1));
export const weeksDesc = db => weeksAsc(db).reverse();
export const player = (db, id) => db.players.find(p => p.id === id);
export const weekRows = (db, k, wid) => db[T[k]].filter(r => r.weekId === wid).sort((a, b) => a.rank - b.rank);
export const history = (db, k, pid) => weeksAsc(db).map(week => ({ week, row: db[T[k]].find(r => r.weekId === week.id && r.playerId === pid) })).filter(x => x.row);
/** Newest week that actually has scores for this event (PR or SR). */
export const latestWeekFor = (db, k) => weeksDesc(db).find(w => weekRows(db, k, w.id).length) || null;
export const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

export function playerStats(db, k, pid) {
  const h = history(db, k, pid); if (!h.length) return null;
  const s = h.map(x => x.row.score), total = s.reduce((a, b) => a + b, 0);
  return { total, avg: total / s.length, highest: Math.max(...s), bestRank: Math.min(...h.map(x => x.row.rank)), weeks: s.length, latest: s.at(-1) };
}
/** Overall average per player across every stored week. */
export function averages(db, k) {
  const acc = {};
  db[T[k]].forEach(r => (acc[r.playerId] ||= []).push(r.score));
  return Object.entries(acc).map(([playerId, a]) => ({ playerId, score: mean(a), weeks: a.length })).sort((a, b) => b.score - a.score).map((r, i) => ({ ...r, rank: i + 1 }));
}
/** All-time personal best per player (highest weekly score) with the week it was set. */
export function records(db, k) {
  return db.players.map(p => {
    const h = history(db, k, p.id); if (!h.length) return null;
    const best = h.reduce((m, x) => (x.row.score > m.row.score ? x : m));
    return { playerId: p.id, score: best.row.score, week: best.week };
  }).filter(Boolean).sort((a, b) => b.score - a.score).map((r, i) => ({ ...r, rank: i + 1 }));
}
export const bestRecord = (db, k) => records(db, k)[0] || null;

const buildCompare = (avg, ra, rb) => [...new Set([...Object.keys(ra), ...Object.keys(rb)])].map(playerId => {
  const sa = ra[playerId], sb = rb[playerId], av = avg[playerId], both = sa != null && sb != null, cur = sb != null && av != null;
  return { playerId, a: sa, b: sb, avg: av, change: both ? sb - sa : null, changePct: both ? pct(sa, sb) : null, vsAvg: cur ? sb - av : null, vsAvgPct: cur ? pct(av, sb) : null };
}).sort((x, y) => (y.b ?? -1) - (x.b ?? -1));
/** Week A vs week B per player, plus each player's overall average and how week B compares to it. */
export function compareWithAvg(db, k, a, b) {
  const avg = Object.fromEntries(averages(db, k).map(r => [r.playerId, r.score]));
  const ra = Object.fromEntries(weekRows(db, k, a).map(r => [r.playerId, r.score])), rb = Object.fromEntries(weekRows(db, k, b).map(r => [r.playerId, r.score]));
  return buildCompare(avg, ra, rb);
}

// ---------- Kraken (monthly event). Each row: { monthId:'2026-09', playerId, rank, damage, sparks } ----------
const KR = db => db.krScores || [];
export const krMonths = db => [...new Set(KR(db).map(r => r.monthId))].sort();
export const krMonthRows = (db, m) => KR(db).filter(r => r.monthId === m).sort((a, b) => a.rank - b.rank || b.damage - a.damage);
/** Clan totals for one month. */
export function krTotals(db, m) {
  const rows = krMonthRows(db, m), damage = rows.reduce((s, r) => s + r.damage, 0), sparks = rows.reduce((s, r) => s + r.sparks, 0);
  return { players: rows.length, damage, sparks, avgDamage: rows.length ? damage / rows.length : 0, top: rows[0] || null };
}
export const krHistory = (db, pid) => krMonths(db).map(monthId => ({ monthId, row: KR(db).find(r => r.monthId === monthId && r.playerId === pid) })).filter(x => x.row);
/** Month A vs month B per player for one metric ('damage' or 'sparks'), with each player's average over ALL Kraken months. */
export function krCompare(db, metric, a, b) {
  const acc = {}; KR(db).forEach(r => (acc[r.playerId] ||= []).push(r[metric]));
  const avg = Object.fromEntries(Object.entries(acc).map(([id, v]) => [id, mean(v)]));
  const ra = Object.fromEntries(krMonthRows(db, a).map(r => [r.playerId, r[metric]])), rb = Object.fromEntries(krMonthRows(db, b).map(r => [r.playerId, r[metric]]));
  return buildCompare(avg, ra, rb);
}
/** Each player's best single-month damage, with the month it happened. */
export function krRecords(db) {
  const best = {};
  KR(db).forEach(r => { if (!best[r.playerId] || r.damage > best[r.playerId].damage) best[r.playerId] = r; });
  return Object.values(best).sort((x, y) => y.damage - x.damage).map((r, i) => ({ playerId: r.playerId, damage: r.damage, sparks: r.sparks, monthId: r.monthId, rank: i + 1 }));
}
/** Average score per participant for each week (for the Overview trend). */
export const weeklyAvg = (db, k) => weeksAsc(db).map(week => { const r = weekRows(db, k, week.id); return { week, value: mean(r.map(x => x.score)) }; });
/** 0–6 rating: how close a player is to each week's leader, averaged over PR and SR. */
export function rating(db, pid) {
  const parts = ['pr', 'sr'].map(k => { const h = history(db, k, pid); return h.length ? mean(h.map(x => x.row.score / (weekRows(db, k, x.week.id)[0]?.score || x.row.score))) : null; }).filter(v => v != null);
  return parts.length ? 6 * mean(parts) : 0;
}
