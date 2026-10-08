const trim = x => x.toLocaleString('en-US', { maximumFractionDigits: 2 });
export const fmtPR = n => (n == null ? '—' : Math.round(n).toLocaleString('en-US'));
/** Space Race scores: exact to 2 decimals (577.8B stays 577.8B, never rounded to 578B). */
export const fmtSR = n => (n == null ? '—' : n >= 1e9 ? trim(n / 1e9) + 'B' : n >= 1e6 ? trim(n / 1e6) + 'M' : trim(n));
export const fmt = (k, n) => (k === 'pr' ? fmtPR(n) : fmtSR(n));
export const fmtK = n => (n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n)));
export const fmtAxis = (k, n) => (k === 'pr' ? fmtK(n) : fmtSR(n));
export const fmtDelta = (k, d) => (d > 0 ? '+' : d < 0 ? '-' : '') + fmt(k, Math.abs(d));
export const pct = (a, b) => (a ? ((b - a) / a) * 100 : null);
export const fmtPct = p => (p == null ? '—' : (p > 0 ? '+' : '') + p.toFixed(1) + '%');
const iso = d => d.toISOString().slice(0, 10);
export const makeWeekId = (y, w) => `${y}-W${String(w).padStart(2, '0')}`;
export const validWeekId = id => /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(id);
export function weekRange(id) {
  const [y, w] = id.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const mon = jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 864e5 + (w - 1) * 7 * 864e5;
  return { startDate: iso(new Date(mon)), endDate: iso(new Date(mon + 6 * 864e5)) };
}
export const shortDate = s => new Date(s + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
export const weekLabel = w => `Week ${w.weekNumber} • ${shortDate(w.startDate)} – ${shortDate(w.endDate)}`;
/** Compact label for dropdowns: "Wk 37 · Sep 7–13" or "Wk 40 · Sep 28–Oct 4". */
export const weekShort = w => {
  const a = shortDate(w.startDate), b = shortDate(w.endDate), sameMonth = a.split(' ')[0] === b.split(' ')[0];
  return `Wk ${w.weekNumber} · ${a}–${sameMonth ? b.split(' ')[1] : b}`;
};
export const initials = n => (String(n).replace(/^[^A-Za-z0-9]+/, '').slice(0, 1) || '?').toUpperCase();

// ---- Import helpers: turn whatever is typed in a spreadsheet into a week ID / number ----
const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
export function isoWeekId(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3); // Thursday of this ISO week
  const y = t.getUTCFullYear(), jan4 = new Date(Date.UTC(y, 0, 4));
  const w = 1 + Math.round(((t - jan4) / 864e5 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return makeWeekId(y, w);
}
/** Accepts 2026-W38, W38, "Week 38", 18Sep, "18 Sep 2026", Sep 18, 2026-09-18, 18/09/2026. Returns a week ID or null. */
export function parseWeek(input, now = new Date()) {
  const s = String(input || '').trim();
  if (!s) return null;
  if (validWeekId(s.toUpperCase())) return s.toUpperCase();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const mk = (y, m, d, explicitYear) => {
    if (m == null || m < 0 || m > 11) return null;
    const pick = yy => { const dt = new Date(Date.UTC(yy, m, d)); return dt.getUTCMonth() === m && dt.getUTCDate() === d ? dt : null; };
    let dt = pick(y); if (!dt) return null;
    // Year not typed (e.g. "18Sep"): assume this year, unless that puts it far in the future.
    if (!explicitYear && dt.getTime() > today + 60 * 864e5) dt = pick(y - 1) || dt;
    return isoWeekId(dt);
  };
  const Y = now.getUTCFullYear(); let m;
  if ((m = /^(?:week|wk|w)\s*-?\s*(\d{1,2})$/i.exec(s))) { const id = makeWeekId(Y, +m[1]); return validWeekId(id) ? id : null; }
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) return mk(+m[1], m[2] - 1, +m[3], true);
  if ((m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(s))) return mk(+m[3], m[2] - 1, +m[1], true);
  if ((m = /^(\d{1,2})[\s\-\/.]*([A-Za-z]{3,9})[\s\-\/.,]*(\d{4})?$/.exec(s))) return mk(m[3] ? +m[3] : Y, MON[m[2].slice(0, 3).toLowerCase()], +m[1], !!m[3]);
  if ((m = /^([A-Za-z]{3,9})[\s\-\/.]*(\d{1,2})(?:[\s,\-\/.]+(\d{4}))?$/.exec(s))) return mk(m[3] ? +m[3] : Y, MON[m[1].slice(0, 3).toLowerCase()], +m[2], !!m[3]);
  return null;
}
/** "30,408" -> 30408, "740B" -> 740000000000, "" -> null, junk -> NaN */
export function parseScore(v) {
  const s = String(v ?? '').trim().replace(/[,\s_]/g, '');
  if (s === '') return null;
  const m = /^(-?\d+(?:\.\d+)?)([KMBT])?$/i.exec(s);
  if (!m) return NaN;
  return Math.round(Number(m[1]) * ({ K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[(m[2] || '').toUpperCase()] || 1));
}

// ---- Kraken (monthly event) helpers ----
/** Like parseScore but keeps decimals: "5,967.9" -> 5967.9 (Kraken damage). Suffixes K/M/B/T still work. */
export function parseDecimal(v) {
  const s = String(v ?? '').trim().replace(/[,\s_]/g, '');
  if (s === '') return null;
  const m = /^(-?\d+(?:\.\d+)?)([KMBT])?$/i.exec(s);
  if (!m) return NaN;
  return m[2] ? Math.round(Number(m[1]) * { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[m[2].toUpperCase()]) : Number(m[1]);
}
/**
 * Kraken damage and sparks are shown in millions: 598432100 -> "598.43M", 3912450 -> "3.91M" (up to 2 decimals).
 * Small values (under 10,000) are shown as plain numbers so they are never misread as "0M".
 */
export const fmtMil = n => (n == null ? '—' : n === 0 ? '0' : Math.abs(n) < 1e4 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : (n / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 }) + 'M');
export const fmtMilDelta = d => (d > 0 ? '+' : d < 0 ? '-' : '') + fmtMil(Math.abs(d));
export const fmtDmg = fmtMil, fmtSparks = fmtMil, fmtDmgDelta = fmtMilDelta, fmtSparksDelta = fmtMilDelta;
/**
 * Accepts 2026-09, Sep 2026, September 2026, 09/2026, 2026-09-18, 18Sep, or just "Sep".
 * Returns "YYYY-MM" or null. With no year typed: this year, unless that month is more than a month ahead.
 * (A bare two-digit number after the name, like "Sep 26", is rejected on purpose: it could be a day or a year.)
 */
export function parseMonth(input, now = new Date()) {
  const s = String(input || '').trim();
  if (!s) return null;
  const Y = now.getUTCFullYear(), nowIdx = Y * 12 + now.getUTCMonth();
  const id = (y, m) => (m >= 0 && m <= 11 && y >= 2000 && y <= 2100 ? `${y}-${String(m + 1).padStart(2, '0')}` : null);
  const guess = m => (m == null ? null : Y * 12 + m > nowIdx + 1 ? id(Y - 1, m) : id(Y, m));
  let m;
  if ((m = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(s))) return id(+m[1], m[2] - 1);
  if ((m = /^(\d{1,2})[\/.-](\d{4})$/.exec(s))) return id(+m[2], m[1] - 1);
  if ((m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(s))) return id(+m[3], m[2] - 1);
  if ((m = /^(\d{1,2})[\s\-\/.]*([A-Za-z]{3,9})[\s\-\/.,]*(\d{4})?$/.exec(s))) { const mi = MON[m[2].slice(0, 3).toLowerCase()]; return mi == null ? null : m[3] ? id(+m[3], mi) : guess(mi); }
  if ((m = /^([A-Za-z]{3,9})[\s\-\/.,]*(\d{4})?$/.exec(s))) { const mi = MON[m[1].slice(0, 3).toLowerCase()]; return mi == null ? null : m[2] ? id(+m[2], mi) : guess(mi); }
  return null;
}
const monthDate = id => new Date(Date.UTC(+id.slice(0, 4), +id.slice(5, 7) - 1, 1));
export const monthLabel = id => monthDate(id).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
export const monthShort = id => monthDate(id).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
