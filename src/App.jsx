import React, { useEffect, useRef, useState } from 'react';
import { TAGLINE } from './config.js';
import { CLANS } from './clans.js';
import { ClanContext, clanValue } from './clanContext.js';
import { switchClan, isLocked, isMembersOnly, lockDevice, getAccess } from './services/db.js';
import Lock from './components/Lock.jsx';
import { SignIn, NotApproved } from './components/Access.jsx';
import { cloudEnabled, isCloudAdmin, cloudSignOut } from './services/cloud.js';
import { getUser, onUser } from './services/session.js';
import { Emblem, Wordmark } from './components/ui.jsx';
import Overview from './pages/Overview.jsx';
import Race from './pages/Race.jsx';
import { PlayerList, Profile } from './pages/Players.jsx';
import { Records, Ratings, Trends } from './pages/Misc.jsx';
import { Kraken } from './pages/Kraken.jsx';
import Admin, { Gate } from './pages/Admin.jsx';
import { isAdmin, lock } from './services/admin.js';

const NAV = [
  ['', 'Overview', '⌂', 'Clan performance at a glance'],
  ['piggy', 'Piggy Race', '🐷', 'Overall, event and week-by-week PR comparison'],
  ['space', 'Space Race', '🚀', 'Overall, event and week-by-week SR comparison'],
  ['kraken', 'Kraken', '🐙', 'Monthly clan damage, sparks and month-to-month comparison'],
  ['trends', 'Trends', '↗', 'Compare players over time'],
  ['ratings', 'Player Ratings', '★', 'How close each player is to the weekly leader'],
  ['players', 'Players', '●', 'Individual performance history and profiles'],
  ['records', 'Records', '♛', 'All-time personal bests'],
  ['admin', 'Data', '⚙', 'Import scores and manage players'],
];
const THEMES = ['tricolour', 'midnight'];
const useHash = () => {
  const [h, set] = useState(location.hash.slice(2));
  useEffect(() => { const f = () => { set(location.hash.slice(2)); window.scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return h;
};

/** "#/clan2/players/p001?x=1" -> { clan: clan2, root: 'players', arg: 'p001', qs: 'x=1' }. Without a clan prefix it is the first clan. */
const parseRoute = hash => {
  const [path, qs = ''] = hash.split('?'), parts = path.split('/'), other = CLANS.slice(1).find(c => c.id === parts[0]), rest = other ? parts.slice(1) : parts;
  return { clan: other || CLANS[0], root: rest[0] || '', arg: rest[1], qs };
};

export default function App() {
  const hash = useHash(), [open, setOpen] = useState(false), [admin, setAdmin] = useState(isAdmin());
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || 'tricolour');
  const { clan, root, arg, qs } = parseRoute(hash), ctx = clanValue(clan, clan === CLANS[0]);
  const [loaded, setLoaded] = useState(null); // id of the clan whose data is loaded
  const [, setTick] = useState(0), bump = () => setTick(t => t + 1);
  const [authTick, setAuthTick] = useState(0), seen = useRef(undefined);
  // Firebase mode: reload the clan's data whenever someone signs in or out.
  useEffect(() => cloudEnabled ? onUser(() => { const e = getUser()?.email || ''; if (seen.current !== undefined && seen.current !== e) setAuthTick(t => t + 1); seen.current = e; }) : undefined, []);
  useEffect(() => { let live = true; setLoaded(null); switchClan(clan.id).then(() => { if (live) { setLoaded(clan.id); bump(); } }); return () => { live = false; }; }, [clan.id, authTick]);
  const adminNow = cloudEnabled ? isCloudAdmin() : admin;
  const retry = () => switchClan(clan.id).then(bump);
  useEffect(() => { document.title = `${clan.name} Stat Center`; }, [clan.name]);
  const go = p => { location.hash = '/' + ctx.prefix + p; setOpen(false); };
  const cur = NAV.find(n => n[0] === root) || NAV[0];
  const flip = () => {
    const t = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    document.documentElement.dataset.theme = t; setTheme(t);
    try { localStorage.setItem('indians-theme', t); } catch {}
  };
  const params = new URLSearchParams(qs);
  let page;
  if (loaded !== clan.id) page = <div className="sub" style={{ padding: 24, textAlign: 'center' }}>Loading {clan.name}…</div>;
  else if (getAccess() === 'signin') page = <SignIn />;
  else if (getAccess() === 'denied') page = <NotApproved onRetry={retry} />;
  else if (isLocked()) page = <Lock onDone={bump} />;
  else switch (root) {
    case 'piggy': page = <Race key={'pr' + qs} k="pr" go={go} params={params} />; break;
    case 'space': page = <Race key={'sr' + qs} k="sr" go={go} params={params} />; break;
    case 'kraken': page = <Kraken go={go} />; break;
    case 'trends': page = <Trends key={qs} params={params} />; break;
    case 'ratings': page = <Ratings go={go} />; break;
    case 'players': page = arg ? <Profile id={arg} go={go} /> : <PlayerList />; break;
    case 'records': page = <Records go={go} />; break;
    case 'admin': page = adminNow ? <Admin onLock={() => { if (cloudEnabled) cloudSignOut(); else { lock(); setAdmin(false); go(''); } }} /> : <Gate onUnlock={() => setAdmin(true)} />; break;
    default: page = <Overview go={go} />;
  }
  return (
    <ClanContext.Provider value={ctx}>
      <div className="shell">
        <div className={'scrim' + (open ? ' on' : '')} onClick={() => setOpen(false)} />
        <nav className={'nav' + (open ? ' on' : '')} aria-label="Main menu">
          <div className="brand"><Emblem /><div><Wordmark size={21} bar /><small>{TAGLINE}</small></div></div>
          {NAV.filter(n => n[0] !== 'admin' || adminNow).map(([k, l, i]) => <a key={k} href={ctx.href(k)} className={k === cur[0] ? 'on' : ''} onClick={() => setOpen(false)}><span>{i}</span>{l}</a>)}
          {isMembersOnly() && !isLocked() && <button className="btn g" style={{ marginTop: 10 }} onClick={async () => { await lockDevice(); bump(); setOpen(false); }}>🔒 Lock this device</button>}
          {cloudEnabled && getUser() && <div className="src" style={{ marginTop: 10 }}><div className="up">Signed in</div><div style={{ overflowWrap: 'anywhere' }}>{getUser().email}</div><button className="btn g" style={{ marginTop: 8, width: '100%' }} onClick={() => { cloudSignOut(); setOpen(false); }}>Sign out</button></div>}
          <div className="src"><div className="up">Data source</div>{clan.name} weekly score log</div>
        </nav>
        <header className="hdr">
          <button className="ico menu" aria-label="Open menu" onClick={() => setOpen(true)}>☰</button>
          <div className="t"><h1>{root === 'players' && arg ? 'Player Profile' : cur[1]}</h1><small>{CLANS.length > 1 ? clan.name + ' · ' : ''}{cur[3]}</small></div>
          <button className="ico" aria-label="Switch theme" title="Switch theme" onClick={flip}>🎨</button>
        </header>
        <main className="main">
          {CLANS.length > 1 && <div className="clanbar" role="tablist" aria-label="Clan">{CLANS.map((c, i) => <a key={c.id} role="tab" aria-selected={c.id === clan.id} href={'#/' + (i === 0 ? '' : c.id + '/')} className={c.id === clan.id ? 'on' : ''}>{c.name}</a>)}</div>}
          {page}
        </main>
      </div>
    </ClanContext.Provider>
  );
}
