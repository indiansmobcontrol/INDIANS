// Small, dependency-free CSV parser: handles quotes, BOM, and , ; or tab delimiters.
// Returns [{ line, cells }] with blank lines removed (line = original line number).
export function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/, 1)[0] || '';
  const d = [',', ';', '\t'].map(c => [c, first.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
  const out = []; let row = [], cur = '', q = false, line = 1;
  const push = () => { row.push(cur); cur = ''; out.push({ line, cells: row }); row = []; line++; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === d) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; push(); }
    else cur += c;
  }
  if (cur !== '' || row.length) push();
  return out.filter(r => r.cells.some(x => x.trim() !== ''));
}
