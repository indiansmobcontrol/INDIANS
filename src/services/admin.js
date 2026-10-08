// Owner-only features: passcode gate + one-click publish of the data to GitHub.
import { ADMIN_PASSCODE } from '../config.js';
import { exportJson, getClanId } from './db.js';
import { encryptText } from './crypto.js';
import { cloudEnabled, isCloudAdmin } from './cloud.js';

const A = 'indians-admin', T = 'indians-gh-token', R = 'indians-gh-repo';
const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const del = k => { try { localStorage.removeItem(k); } catch {} };

export const isAdmin = () => (cloudEnabled ? isCloudAdmin() : get(A) === '1');
export const unlock = code => { if (code === ADMIN_PASSCODE) { set(A, '1'); return true; } return false; };
export const lock = () => del(A);
export const getToken = () => get(T) || '';
export const setToken = t => set(T, t.trim());
export const clearToken = () => del(T);
export function getRepo() { try { return JSON.parse(get(R)) || {}; } catch { return {}; } }
export const saveRepo = (owner, repo) => set(R, JSON.stringify({ owner: owner.trim(), repo: repo.trim() }));
/** On https://USER.github.io/REPO/ we can work out the user and repository name automatically. */
export function repoFromLocation(loc = location) {
  const host = loc.hostname || '';
  return host.endsWith('.github.io') ? { owner: host.split('.')[0], repo: (loc.pathname.split('/')[1] || '') } : { owner: '', repo: '' };
}

/** Members-only passphrase used when PUBLISHING, remembered per clan on the owner's device. */
const PP = () => `indians-pub-pass:${getClanId()}`;
export const getPubPass = () => get(PP()) || '';
export const setPubPass = p => set(PP(), p.trim());
export const clearPubPass = () => del(PP());
export const MIN_PASS = 8;
/** The text that gets published: encrypted when a members-only passphrase is set for this clan, plain JSON otherwise. */
export async function buildPublishText() {
  const pass = getPubPass();
  return pass ? JSON.stringify(await encryptText(JSON.stringify(JSON.parse(exportJson())), pass)) : exportJson();
}
const b64 = s => btoa(unescape(encodeURIComponent(s)));
const hint = s => (s === 401 ? 'The token is wrong or expired. Make a new one.' : s === 403 || s === 404 ? 'The token cannot access this repository. Check the repo name, and that the token has Contents: Read and write for it.' : s === 409 || s === 422 ? 'GitHub rejected the update (conflict). Try again in a moment.' : '');
async function fail(res) {
  let m = ''; try { m = (await res.json()).message || ''; } catch {}
  return { ok: false, message: `GitHub said ${res.status}${m ? ` (${m})` : ''}. ${hint(res.status)}`.trim() };
}
/** Writes the current data to public/data.json in the repo. The site then redeploys itself in a minute or two. */
export async function publishToGitHub({ owner, repo, token, branch = 'main', path = 'public/data.json' }) {
  if (!owner || !repo) return { ok: false, message: 'Enter your GitHub username and repository name.' };
  if (!token) return { ok: false, message: 'Add your GitHub token first.' };
  const api = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  try {
    let sha;
    const cur = await fetch(`${api}?ref=${encodeURIComponent(branch)}`, { headers });
    if (cur.ok) sha = (await cur.json()).sha; else if (cur.status !== 404) return await fail(cur);
    const put = await fetch(api, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Update stats data', content: b64(await buildPublishText()), branch, ...(sha ? { sha } : {}) }) });
    return put.ok ? { ok: true, message: 'Published! The website updates in about 1 to 2 minutes.' } : await fail(put);
  } catch { return { ok: false, message: 'Could not reach GitHub. Check your internet connection.' }; }
}
