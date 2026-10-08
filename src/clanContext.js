import { createContext, useContext } from 'react';
// Tells every component which clan the page is showing, and how to build links that stay inside that clan.
export const ClanContext = createContext({ id: 'main', name: '', file: 'data.json', prefix: '', href: p => '#/' + p });
export const useClan = () => useContext(ClanContext);
export const clanValue = (clan, isDefault) => { const prefix = isDefault ? '' : clan.id + '/'; return { ...clan, prefix, href: p => '#/' + prefix + p }; };
