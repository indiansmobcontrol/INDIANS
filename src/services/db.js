// Data layer. The UI reads and writes ONLY through this file, so swapping localStorage
// for Supabase / Firebase / a REST API later means changing this folder and nothing else.
import { seed } from '../data/seed.js';
import { validWeekId, weekRange, parseWeek, parseScore, parseMonth, parseDecimal } from '../utils/format.js';
import { parseCsv } from '../utils/csv.js';
import { isEncrypted, decryptText } from './crypto.js';
import { CLANS } from '../clans.js';
import { cloudEnabled, cloudReady, cloudFetch } from './cloud.js';
import { getUser } from './session.js';

// Each clan has its own saved data. The first clan keeps the original key, so data saved before multi-clan support is untouched.
const BASE = 'indians-stats:v4';
let clanId = CLANS[0].id;
const clanDef = () => CLANS.find(c => c.id === clanId) || CLANS[0];
const key = () => (clanDef() === CLANS[0] ? BASE : `${BASE}:clan:${clanDef().id}`);
const K = { pr: 'prScores', sr: 'srScores' };
let state = null; const subs = new Set();
const load = () => {
  if (state) return state;
  try { state = JSON.parse(localStorage.getItem(key())); } catch { state = null; }
  state ||= seed();
  if (!state.krScores) state.krScores = []; // data saved before Kraken existed
  return state;
};
const commit = () => { state = { ...state }; try { localStorage.setItem(key(), JSON.stringify(state)); } catch {} subs.forEach(f => f()); };
export const subscribe = f => (subs.add(f), () => subs.delete(f));

// One-level undo: before any destructive change we keep a copy of the data, so a wrong import or delete can be reverted.
const UK = () => key() + ':undo';
const snapshot = label => { try { localStorage.setItem(UK(), JSON.stringify({ label, at: Date.now(), data: load() })); } catch { /* storage full: no undo */ } };
/** The last undoable change, e.g. { label: 'Import of 44 rows', at: 1700000000000 }, or null. */
export const getUndo = () => { try { const u = JSON.parse(localStorage.getItem(UK())); return u ? { label: u.label, at: u.at } : null; } catch { return null; } };
export function undoLast() {
  try { const u = JSON.parse(localStorage.getItem(UK())); if (!u) return false; state = { ...seed(), ...u.data }; localStorage.removeItem(UK()); commit(); return true; } catch { return false; }
}
const rerank = (list, wid) => {
  const rk = new Map(list.filter(r => r.weekId === wid).sort((a, b) => b.score - a.score).map((r, i) => [r.playerId, i + 1]));
  return list.map(r => (r.weekId === wid ? { ...r, rank: rk.get(r.playerId) } : r));
};
const rerankKr = (list, mid, byDamage = false) => {
  const rows = list.filter(r => r.monthId === mid).sort((a, b) => (byDamage ? 0 : a.rank - b.rank) || b.damage - a.damage);
  const rk = new Map(rows.map((r, i) => [r.playerId, i + 1]));
  return list.map(r => (r.monthId === mid ? { ...r, rank: rk.get(r.playerId) } : r));
};
// The UI reads a *view*: players marked "Left" (and their scores) are hidden and ranks recomputed.
// The raw data keeps everything, so hiding someone is reversible.
let viewSrc = null, view = null;
const makeView = s => {
  const gone = new Set(s.players.filter(p => p.status === 'Left').map(p => p.id));
  if (!gone.size) return s;
  const strip = list => { let out = list.filter(r => !gone.has(r.playerId)); new Set(list.filter(r => gone.has(r.playerId)).map(r => r.weekId)).forEach(w => (out = rerank(out, w))); return out; };
  let kr = s.krScores.filter(r => !gone.has(r.playerId));
  new Set(s.krScores.filter(r => gone.has(r.playerId)).map(r => r.monthId)).forEach(m => (kr = rerankKr(kr, m)));
  return { ...s, players: s.players.filter(p => !gone.has(p.id)), prScores: strip(s.prScores), srScores: strip(s.srScores), krScores: kr };
};
export const getDb = () => { const s = load(); if (view && viewSrc === s) return view; viewSrc = s; return (view = makeView(s)); };
export const getAllPlayers = () => load().players;
export const exportJson = () => JSON.stringify(load(), null, 2);
/** Compact JSON (no indentation) for Firestore, which allows 1 MB per document. */
export const exportCompact = () => JSON.stringify(load());
export const resetDb = () => { try { localStorage.removeItem(key()); } catch {} state = null; };

// Members-only: when the published file is encrypted, visitors must enter the clan passphrase (remembered on that device).
let locked = null, membersOnly = false;
// Firebase mode: 'ok' | 'signin' (nobody signed in) | 'denied' (signed in, but not an approved member of this clan)
let access = 'ok';
export const getAccess = () => access;
const PK = () => `indians-pass:${clanId}`;
const getPass = () => { try { return localStorage.getItem(PK()) || ''; } catch { return ''; } };
export const isLocked = () => !!locked;
export const isMembersOnly = () => membersOnly;
const validShape = j => !!(j && Array.isArray(j.players) && Array.isArray(j.weeks) && Array.isArray(j.prScores) && Array.isArray(j.srScores));
/** Try a passphrase on the locked clan. Resolves true (and remembers it on this device) if it works. */
export async function unlockClan(pass) {
  if (!locked) return true;
  const mine = clanId, lk = locked;
  try {
    const j = JSON.parse(await decryptText(lk.payload, pass.trim()));
    if (!validShape(j) || clanId !== mine || locked !== lk) return false; // wrong data, or the visitor switched clan meanwhile
    state = { ...seed(), ...j }; viewSrc = null; view = null; locked = null; membersOnly = true; pubInfo = 'loaded (members only, unlocked)';
    try { localStorage.setItem(PK(), pass.trim()); } catch {}
    subs.forEach(f => f()); return true;
  } catch { return false; }
}
/** Forget the passphrase on this device and lock the clan again. */
export async function lockDevice() { try { localStorage.removeItem(PK()); } catch {} return switchClan(clanId); }
let pubInfo = 'not checked yet';
/** Plain-English result of looking for the published data file (shown on empty pages to help debugging). */
export const getPublishInfo = () => pubInfo;
export const getClanId = () => clanId;
/**
 * Switch to a clan and load its data. With no saved data in this browser, the clan's published file
 * (public/data.json for the first clan, public/data-<id>.json for the others) is used.
 */
export async function switchClan(id) {
  clanId = (CLANS.find(c => c.id === id) || CLANS[0]).id;
  state = null; viewSrc = null; view = null; locked = null; membersOnly = false; access = 'ok';
  const file = clanDef().file;
  try {
    if (localStorage.getItem(key())) {
      pubInfo = 'this browser is using its own saved data';
      if (cloudEnabled) { try { await cloudReady(); } catch { /* Firebase unavailable: carry on with the local data */ } } // let Firebase restore the signed-in session first
      subs.forEach(f => f()); return;
    }
  } catch {}
  if (cloudEnabled) { await loadFromCloud(clanId); subs.forEach(f => f()); return; }
  try {
    const r = await fetch(`${file}?v=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) pubInfo = `${file} not found (HTTP ${r.status})`;
    else {
      let j; try { j = await r.json(); } catch { j = undefined; }
      if (j === undefined) pubInfo = `${file} is not valid JSON`;
      else if (isEncrypted(j)) {
        membersOnly = true; locked = { payload: j }; pubInfo = 'members only (locked)';
        const saved = getPass();
        if (saved && !(await unlockClan(saved))) { try { localStorage.removeItem(PK()); } catch {} } // remembered passphrase is out of date: ask again
      }
      else if (!validShape(j)) pubInfo = `${file} has the wrong format`;
      else { state = { ...seed(), ...j }; pubInfo = j.weeks.length ? `loaded ${j.weeks.length} weeks, ${j.players.length} players` : `${file} was found but has no weeks yet`; }
    }
  } catch { pubInfo = `${file} could not be loaded (network problem)`; }
  subs.forEach(f => f());
}
/** Firebase mode: members sign in with Google and the data comes from Firestore (stats/<clanId>). */
async function loadFromCloud(id) {
  try { await cloudReady(); } catch (e) { pubInfo = `Firebase could not start (${e.message || e})`; return; }
  if (!getUser()) { access = 'signin'; pubInfo = 'sign-in required'; return; }
  const r = await cloudFetch(id);
  if (r.status === 'denied') { access = 'denied'; pubInfo = 'signed in, but not an approved member'; return; }
  if (r.status === 'missing') { pubInfo = 'nothing has been published to Firebase yet'; return; }
  if (r.status === 'error') { pubInfo = `Firebase error: ${r.message}`; return; }
  let j; try { j = JSON.parse(r.text); } catch { pubInfo = 'the published data is not valid JSON'; return; }
  if (!validShape(j)) { pubInfo = 'the published data has the wrong format'; return; }
  state = { ...seed(), ...j }; pubInfo = j.weeks.length ? `loaded ${j.weeks.length} weeks, ${j.players.length} players` : 'published data has no weeks yet';
}
export const initDb = () => switchClan(clanId);

// ---------- players ----------
const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const nextId = players => 'p' + String(Math.max(0, ...players.map(p => Number(p.id.slice(1)) || 0)) + 1).padStart(3, '0');
export function addPlayer(name) {
  const n = clean(name), db = load();
  if (!n) return 'Enter a name.';
  if (db.players.some(p => p.name === n)) return `"${n}" already exists.`;
  state = { ...db, players: [...db.players, { id: nextId(db.players), name: n, status: 'Active' }] }; commit(); return '';
}
export function renamePlayer(id, name) {
  const n = clean(name), db = load();
  if (!n) return 'Name cannot be empty.';
  if (db.players.some(p => p.name === n && p.id !== id)) return `"${n}" already exists.`;
  state = { ...db, players: db.players.map(p => (p.id === id ? { ...p, name: n } : p)) }; commit(); return '';
}
export function setStatus(id, status) { const db = load(); state = { ...db, players: db.players.map(p => (p.id === id ? { ...p, status } : p)) }; commit(); }
/** Permanently delete a player and all their scores; affected weeks are re-ranked. */
export function deletePlayer(id) {
  const db = load(); snapshot(`Deleted player ${db.players.find(p => p.id === id)?.name || id}`);
  const next = { ...db, players: db.players.filter(p => p.id !== id) };
  ['prScores', 'srScores'].forEach(t => {
    const weeks = new Set(db[t].filter(r => r.playerId === id).map(r => r.weekId));
    let list = db[t].filter(r => r.playerId !== id); weeks.forEach(w => (list = rerank(list, w))); next[t] = list;
  });
  const krMonthsHit = new Set(db.krScores.filter(r => r.playerId === id).map(r => r.monthId));
  next.krScores = db.krScores.filter(r => r.playerId !== id);
  krMonthsHit.forEach(m => (next.krScores = rerankKr(next.krScores, m)));
  state = next; commit();
}
/** Permanently delete one Kraken month and every row in it. */
export function deleteKrakenMonth(id) { const db = load(); snapshot(`Deleted Kraken ${id}`); state = { ...db, krScores: db.krScores.filter(r => r.monthId !== id) }; commit(); }
/** Delete only the PR or only the SR scores of one week. The week itself goes too once it has no scores left. */
export function deleteWeekEvent(id, k) {
  const db = load(); snapshot(`Deleted ${k.toUpperCase()} scores of ${id}`);
  const next = { ...db, [K[k]]: db[K[k]].filter(r => r.weekId !== id) };
  if (!next[K[k === 'pr' ? 'sr' : 'pr']].some(r => r.weekId === id)) next.weeks = db.weeks.filter(w => w.id !== id);
  state = next; commit();
}
/** Players that have no PR, SR or Kraken data at all (for example left over from a wrongly imported file). */
export function orphanPlayers() {
  const db = load(), used = new Set([...db.prScores, ...db.srScores, ...db.krScores].map(r => r.playerId));
  return db.players.filter(p => !used.has(p.id));
}
export function deleteOrphans() {
  const db = load(), gone = new Set(orphanPlayers().map(p => p.id));
  if (!gone.size) return 0;
  snapshot(`Removed ${gone.size} players with no scores`);
  state = { ...db, players: db.players.filter(p => !gone.has(p.id)) }; commit(); return gone.size;
}
/** Permanently delete a week and every score in it. */
export function deleteWeek(id) {
  const db = load(); snapshot(`Deleted week ${id}`);
  state = { ...db, weeks: db.weeks.filter(w => w.id !== id), prScores: db.prScores.filter(r => r.weekId !== id), srScores: db.srScores.filter(r => r.weekId !== id) }; commit();
}

// ---------- manual week form ----------
const num = v => (v === '' || v == null ? null : Number(v));
/** Create a week, or replace it when {edit:true}. rows: [{playerId, pr, sr}]. Returns a list of errors (empty = saved). */
export function saveWeek(w, rows, { edit = false } = {}) {
  const db = load(), errs = [];
  if (!validWeekId(w.id)) errs.push('Invalid week ID (expected e.g. 2026-W41).');
  if (db.weeks.some(x => x.id === w.id) && !edit) errs.push(`${w.id} already exists. Use Edit on that week instead.`);
  if (w.endDate < w.startDate) errs.push('End date is before start date.');
  const seen = new Set();
  rows.forEach(r => {
    if (!db.players.some(p => p.id === r.playerId)) errs.push(`Unknown player "${r.playerId}".`);
    if (seen.has(r.playerId)) errs.push(`Duplicate entry for ${r.playerId}.`);
    seen.add(r.playerId);
    ['pr', 'sr'].forEach(k => { const v = num(r[k]); if (v != null && !(v >= 0)) errs.push(`${k.toUpperCase()} for ${r.playerId} must be a number ≥ 0.`); });
  });
  if (errs.length) return errs;
  snapshot(`Edited week ${w.id}`);
  const left = new Set(db.players.filter(p => p.status === 'Left').map(p => p.id)); // hidden players keep their scores
  const next = { ...db, weeks: [...db.weeks.filter(x => x.id !== w.id), { id: w.id, weekNumber: Number(w.id.split('-W')[1]), startDate: w.startDate, endDate: w.endDate }] };
  ['pr', 'sr'].forEach(k => {
    const list = db[K[k]].filter(r => r.weekId !== w.id || left.has(r.playerId));
    rows.filter(r => !left.has(r.playerId)).forEach(r => { const s = num(r[k]); if (s != null) list.push({ weekId: w.id, playerId: r.playerId, score: s, rank: 0 }); });
    next[K[k]] = rerank(list, w.id);
  });
  state = next; commit(); return [];
}

// ---------- CSV import ----------
const EV = { PR: 'pr', PIGGY: 'pr', 'PIGGY RACE': 'pr', SR: 'sr', SPACE: 'sr', 'SPACE RACE': 'sr' };
const norm = h => String(h).toLowerCase().replace(/[^a-z]/g, '');
const KDMG = ['dmg', 'damage', 'totaldmg', 'totaldamage'];
/** Which players in the file are new, and which new names look like an existing one spelled with different capitals. */
function nameInfo(rows, db, byName) {
  const news = [...new Set(rows.filter(r => r.name && !byName.has(r.name) && !r.issues.length).map(r => r.name))];
  const lower = new Map(db.players.map(p => [p.name.toLowerCase(), p.name]));
  return { newNames: news, similar: Object.fromEntries(news.filter(n => lower.has(n.toLowerCase())).map(n => [n, lower.get(n.toLowerCase())])) };
}
/**
 * Read a spreadsheet saved as CSV. Two kinds are recognised automatically:
 *   weekly: Week, Event (PR or SR), Player, Score
 *   Kraken: Month, Player, Rank (optional), Dmg, Sparks
 * Nothing is saved here. Unknown names are flagged as new players; existing data is never overwritten.
 * mapping: { "typed name": existingPlayerId } lets the user say "this new name is really that player".
 */
export function previewCsv(text, mapping = {}, opts = {}) {
  const db = load(), all = parseCsv(text);
  if (!all.length) return { kind: 'weekly', rows: [], fatal: 'File is empty.' };
  if (all[0].cells.map(norm).some(h => KDMG.includes(h))) return previewKraken(db, all, mapping, opts);
  const head = all[0].cells.map(h => h.trim().toLowerCase());
  const col = (...n) => head.findIndex(h => n.includes(h));
  const ci = { Week: col('week', 'weekid', 'week id', 'date'), Event: col('event', 'type', 'race'), Player: col('player', 'name', 'playername', 'player name', 'member'), Score: col('score', 'points', 'value') };
  const miss = Object.entries(ci).filter(([, i]) => i < 0).map(([k]) => k);
  if (miss.length) return { kind: 'weekly', rows: [], fatal: `Missing column(s): ${miss.join(', ')}. Weekly files need: Week, Event, Player, Score. Kraken files need: Month, Player, Rank, Dmg, Sparks.` };
  const byName = new Map(db.players.map(p => [p.name, p])), seen = new Set();
  const rows = all.slice(1).map(({ line, cells }) => {
    const rawWeek = clean(cells[ci.Week]), name = clean(cells[ci.Player]), ev = EV[clean(cells[ci.Event]).toUpperCase()], score = parseScore(cells[ci.Score]);
    const weekId = parseWeek(rawWeek), issues = [];
    if (!weekId) issues.push('Unrecognised week');
    if (!ev) issues.push('Event must be PR or SR');
    if (!name) issues.push('Missing player name');
    if (score == null || Number.isNaN(score)) issues.push('Score is not a number'); else if (score < 0) issues.push('Score is negative');
    const known = mapping[name] ? db.players.find(p => p.id === mapping[name]) : byName.get(name), playerId = known?.id || null;
    if (!issues.length) {
      const key = [weekId, ev, playerId || name].join('|');
      if (seen.has(key)) issues.push('Duplicate row in file'); seen.add(key);
      if (playerId && db[K[ev]].some(r => r.weekId === weekId && r.playerId === playerId)) issues.push(`${ev.toUpperCase()} already saved for this week`);
    }
    return { kind: 'weekly', line, rawWeek, weekId, ev, name, score, playerId, hidden: known?.status === 'Left', isNewPlayer: !!name && !playerId, isNewWeek: !!weekId && !db.weeks.some(w => w.id === weekId), issues };
  });
  return { kind: 'weekly', rows, ...nameInfo(rows, db, byName) };
}
function previewKraken(db, all, mapping, opts = {}) {
  const head = all[0].cells.map(norm), col = (...n) => head.findIndex(h => n.includes(h));
  const ci = { Month: col('month', 'period', 'date'), Player: col('player', 'name', 'member', 'playername'), Damage: col(...KDMG), Sparks: col('sparks', 'spark'), Rank: col('rank', 'position') };
  const miss = ['Month', 'Player', 'Damage', 'Sparks'].filter(k => ci[k] < 0);
  if (miss.length) return { kind: 'kraken', rows: [], fatal: `Missing column(s): ${miss.join(', ')}. Kraken files need: Month, Player, Rank (optional), Dmg, Sparks.` };
  const byName = new Map(db.players.map(p => [p.name, p])), seen = new Set();
  const rows = all.slice(1).map(({ line, cells }) => {
    const rawMonth = clean(cells[ci.Month]), name = clean(cells[ci.Player]), monthId = parseMonth(rawMonth);
    // Numbers with a K/M/B/T suffix ("598.4M") are taken as written. Plain numbers are taken as-is, or as millions when the file is flagged "in millions".
    const mil = opts.millions ? 1e6 : 1, plain = v => !/[KMBT]\s*$/i.test(String(v ?? '').trim());
    let damage = parseDecimal(cells[ci.Damage]), sp = parseDecimal(cells[ci.Sparks]);
    if (mil !== 1 && plain(cells[ci.Damage]) && damage != null && !Number.isNaN(damage)) damage = Math.round(damage * mil);
    if (mil !== 1 && plain(cells[ci.Sparks]) && sp != null && !Number.isNaN(sp)) sp = Math.round(sp * mil);
    if (sp != null && !Number.isNaN(sp)) sp = Math.round(sp); // sparks are whole numbers
    const sparks = sp == null ? 0 : sp;
    const rawRank = ci.Rank >= 0 ? clean(cells[ci.Rank]).replace(/^#/, '') : '', rank = rawRank === '' ? null : Number(rawRank), issues = [];
    if (!monthId) issues.push('Unrecognised month');
    if (!name) issues.push('Missing player name');
    if (damage == null || Number.isNaN(damage)) issues.push('Damage is not a number'); else if (damage < 0) issues.push('Damage is negative');
    if (Number.isNaN(sparks)) issues.push('Sparks is not a number'); else if (sparks < 0) issues.push('Sparks is negative');
    if (rank != null && !(Number.isInteger(rank) && rank >= 1)) issues.push('Rank must be a whole number, 1 or more');
    const known = mapping[name] ? db.players.find(p => p.id === mapping[name]) : byName.get(name), playerId = known?.id || null;
    if (!issues.length) {
      const key = [monthId, playerId || name].join('|');
      if (seen.has(key)) issues.push('Duplicate row in file'); seen.add(key);
      if (playerId && db.krScores.some(r => r.monthId === monthId && r.playerId === playerId)) issues.push('Kraken already saved for this month');
    }
    return { kind: 'kraken', line, rawMonth, monthId, name, rank, damage, sparks, playerId, hidden: known?.status === 'Left', isNewPlayer: !!name && !playerId, isNewMonth: !!monthId && !db.krScores.some(r => r.monthId === monthId), issues };
  });
  return { kind: 'kraken', rows, ...nameInfo(rows, db, byName) };
}
/** Save every valid row. New names become new players automatically. Returns counts. */
export function commitCsv(rows) {
  const db = load(), ok = rows.filter(r => !r.issues.length);
  snapshot(`Import of ${ok.length} rows`);
  const next = { ...db, players: [...db.players], weeks: [...db.weeks], prScores: [...db.prScores], srScores: [...db.srScores], krScores: [...db.krScores] };
  const made = new Map(), touched = new Set(), newWeeks = new Set(), krTouched = new Set(), krBlank = new Set(), newMonths = new Set();
  const pidOf = r => {
    let pid = r.playerId;
    if (!pid && !(pid = made.get(r.name))) { pid = nextId(next.players); made.set(r.name, pid); next.players.push({ id: pid, name: r.name, status: 'Active' }); }
    return pid;
  };
  ok.forEach(r => {
    const pid = pidOf(r);
    if (r.kind === 'kraken') {
      if (!next.krScores.some(x => x.monthId === r.monthId)) newMonths.add(r.monthId);
      next.krScores.push({ monthId: r.monthId, playerId: pid, rank: r.rank ?? 0, damage: r.damage, sparks: r.sparks });
      krTouched.add(r.monthId); if (r.rank == null) krBlank.add(r.monthId);
      return;
    }
    if (!next.weeks.some(w => w.id === r.weekId)) { next.weeks.push({ id: r.weekId, weekNumber: Number(r.weekId.split('-W')[1]), ...weekRange(r.weekId) }); newWeeks.add(r.weekId); }
    touched.add(r.weekId);
    next[K[r.ev]].push({ weekId: r.weekId, playerId: pid, score: r.score, rank: 0 });
  });
  touched.forEach(w => { next.prScores = rerank(next.prScores, w); next.srScores = rerank(next.srScores, w); });
  krBlank.forEach(m => (next.krScores = rerankKr(next.krScores, m, true))); // a blank rank means "rank by damage"
  state = next; commit();
  return { rows: ok.length, players: made.size, weeks: newWeeks.size, months: newMonths.size };
}
