// Who is signed in (Firebase mode). Updated by the Firebase client, read by the app.
let user = null; const subs = new Set();
export const getUser = () => user;
export const setUser = u => { user = u ? { email: String(u.email || '').toLowerCase(), name: u.displayName || '' } : null; subs.forEach(f => f()); };
export const onUser = f => (subs.add(f), () => subs.delete(f));
