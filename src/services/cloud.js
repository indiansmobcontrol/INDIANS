// Thin layer between the app and Firebase. The Firebase SDK is only downloaded when Firebase mode is switched on.
import { FIREBASE } from '../firebaseConfig.js';
import { getUser, setUser } from './session.js';

export const cloudEnabled = !!(FIREBASE.config.apiKey && FIREBASE.config.projectId);
const admins = (FIREBASE.admins || []).map(e => String(e).trim().toLowerCase());
export const isCloudAdmin = () => cloudEnabled && !!getUser() && admins.includes(getUser().email);

let clientP = null;
const client = () => (clientP ||= import('./firebaseClient.js').then(m => m.init(FIREBASE.config, setUser)));
/** Resolves once Firebase knows whether someone is signed in. */
export const cloudReady = async () => { await (await client()).ready; };
export const cloudSignIn = async () => (await client()).signIn();
export const cloudSignOut = async () => (await client()).signOut();
/** -> { status: 'ok', text } | { status: 'missing' } | { status: 'denied' } | { status: 'error', message } */
export const cloudFetch = async id => (await client()).fetchClan(id);
/** -> { ok: true } | { ok: false, denied?: boolean, message } */
export const cloudPublish = async (id, text) => (await client()).publishClan(id, text);
export const cloudMembers = async id => (await client()).listMembers(id);
export const cloudSaveMembers = async (id, emails) => (await client()).saveMembers(id, emails);
