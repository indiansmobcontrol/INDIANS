// The only file that talks to the Firebase SDK.
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';

let auth, db;
const memberId = (clan, email) => `${clan}__${email}`;
const denied = e => e && e.code === 'permission-denied';

export function init(config, onUser) {
  const app = initializeApp(config);
  auth = getAuth(app); db = getFirestore(app);
  const ready = new Promise(resolve => onAuthStateChanged(auth, u => { onUser(u); resolve(); }));
  return { ready, signIn, signOut: () => fbSignOut(auth), fetchClan, publishClan, listMembers, saveMembers };
}

async function signIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(auth, provider);
}

/** Each clan's data is one document: stats/<clanId> with a string field "json". */
async function fetchClan(id) {
  try {
    const snap = await getDoc(doc(db, 'stats', id));
    return snap.exists() ? { status: 'ok', text: snap.data().json } : { status: 'missing' };
  } catch (e) { return denied(e) ? { status: 'denied' } : { status: 'error', message: e.message || String(e) }; }
}
async function publishClan(id, text) {
  try { await setDoc(doc(db, 'stats', id), { json: text, updatedAt: Date.now(), by: auth.currentUser?.email || '' }); return { ok: true }; }
  catch (e) { return { ok: false, denied: denied(e), message: e.message || String(e) }; }
}

/** Approved members of one clan: documents members/<clanId>__<email>. */
async function listMembers(clanId) {
  const snap = await getDocs(collection(db, 'members')), pre = clanId + '__';
  return snap.docs.map(d => d.id).filter(id => id.startsWith(pre)).map(id => id.slice(pre.length)).sort();
}
async function saveMembers(clanId, emails) {
  const cur = new Set(await listMembers(clanId)), next = new Set(emails);
  const ops = [...[...next].filter(e => !cur.has(e)).map(e => ['add', e]), ...[...cur].filter(e => !next.has(e)).map(e => ['del', e])];
  for (let i = 0; i < ops.length; i += 400) { // a batch holds at most 500 writes
    const batch = writeBatch(db);
    ops.slice(i, i + 400).forEach(([t, e]) => { const ref = doc(db, 'members', memberId(clanId, e)); if (t === 'add') batch.set(ref, { addedAt: Date.now() }); else batch.delete(ref); });
    await batch.commit();
  }
  return { added: ops.filter(o => o[0] === 'add').length, removed: ops.filter(o => o[0] === 'del').length, total: next.size };
}
