import React, { useState } from 'react';
import { Card, Wordmark } from './ui.jsx';
import { useClan } from '../clanContext.js';
import { getUser } from '../services/session.js';
import { cloudSignIn, cloudSignOut } from '../services/cloud.js';

const MESSAGES = {
  'auth/popup-closed-by-user': 'The Google window was closed before you finished. Try again.',
  'auth/cancelled-popup-request': 'Another sign-in window was already open. Try again.',
  'auth/popup-blocked': 'Your browser blocked the Google window. Allow pop-ups for this site, or open the site in Chrome or Safari, then try again.',
  'auth/unauthorized-domain': "This website's address is not authorised in Firebase. The owner must add it under Authentication → Settings → Authorized domains.",
  'auth/network-request-failed': 'No internet connection. Check your network and try again.',
  'auth/operation-not-allowed': 'Google sign-in is not switched on in Firebase (Authentication → Sign-in method → Google).',
};
export const signInMessage = e => MESSAGES[e && e.code] || `Sign-in failed (${(e && (e.code || e.message)) || 'unknown error'}).`;

/** Shown instead of the pages when Firebase mode is on and nobody is signed in. */
export function SignIn() {
  const { name } = useClan(), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); setErr(''); try { await cloudSignIn(); } catch (e) { setErr(signInMessage(e)); } setBusy(false); };
  return (
    <Card className="hero">
      <Wordmark size={30} bar />
      <h2>🔒 Members only</h2>
      <div className="sub">The {name} records are only for approved clan members. Sign in with the Google account your clan leader approved.</div>
      <button className="btn" style={{ marginTop: 14 }} disabled={busy} onClick={go}>{busy ? 'Opening Google…' : 'Sign in with Google'}</button>
      {err && <div className="err">⚠ {err}</div>}
      <div className="sub" style={{ marginTop: 12 }}>If the Google window does not open, use Chrome or Safari instead of the WhatsApp or Instagram in-app browser.</div>
    </Card>
  );
}

/** Signed in with Google, but this address is not on the clan's approved list. */
export function NotApproved({ onRetry }) {
  const { name } = useClan(), user = getUser();
  return (
    <Card title="Not approved yet" sub={`You are signed in, but this account is not on the ${name} member list.`}>
      <div className="note" style={{ marginTop: 12 }}>Signed in as <b>{user?.email}</b><br />Send this exact email address to your clan leader. Once they add it, press “Check again”.</div>
      <div className="row" style={{ marginTop: 12, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
        <button className="btn" onClick={onRetry}>Check again</button>
        <button className="btn g" onClick={() => cloudSignOut()}>Use another account</button>
      </div>
    </Card>
  );
}
