import { fmt } from './format.js';
import { player } from '../services/stats.js';
/** Turn [{rank, playerId, score}] into rows the <Board> component can draw. */
export const boardRows = (db, k, rows) => rows.map(r => ({ r, p: player(db, r.playerId) })).filter(x => x.p)
  .map(({ r, p }) => ({ rank: r.rank, playerId: p.id, name: p.name, status: p.status, value: fmt(k, r.score) }));
