// The clans on this site. Add, remove or rename them here.
// - The FIRST clan is the main one: it keeps the normal addresses (#/piggy) and the file public/data.json.
// - Every other clan gets its own address prefix (#/clan2/piggy) and its own file (public/data-clan2.json).
// Change `name` freely. Keep each `id` and `file` fixed once you have data, because they are used in addresses and storage.
import { CLAN } from './config.js';

export const CLANS = [
  { id: 'main', name: CLAN, file: 'data.json' },
  { id: 'clan2', name: 'INDIANS ▢', file: 'data-clan2.json' },
];
