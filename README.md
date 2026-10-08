# INDIANS Stat Center

Clan stats site (React + Vite). Weekly Piggy Race (PR) and Space Race (SR) scores are the single
source of truth: rankings, records, averages, trends and ratings are all calculated from them.

## Two (or more) clans
`src/clans.js` lists the clans. The first is the main site (`#/piggy`, data in `public/data.json`); the second has its own address
prefix (`#/clan2/piggy`) and its own file `public/data-clan2.json`. Each clan has completely separate players, weeks, Kraken data, undo history and
publishing. Use the clan tabs at the top of every page to switch. Rename a clan by changing its `name` in `clans.js` (keep `id` and `file`
unchanged once you have data). On the Data page everything (import, delete, publish) applies to the clan you are currently viewing.

## Sign-in with Google (Firebase) - recommended for large clans
Fill in `src/firebaseConfig.js` (your Firebase web-app config and admin Gmail) and paste `firestore.rules` into Firebase -> Firestore -> Rules.
The site then asks everyone to sign in with Google; only Gmail addresses on a clan's member list can read that clan's records, and only the admin can publish.
Manage the lists on the Data page ("Approved members") and publish with "Publish to Firebase". Leave `config` empty to keep the old GitHub-based publishing.

## Members-only records (passphrase, no Firebase)
Because the site is static, the published `data.json` files are public by default. To restrict a clan's records to its members, open the Data page
(on that clan's tab) -> Publish -> **Members-only access** and set a passphrase, then publish. The data file is then encrypted (AES-256-GCM, key from the
passphrase via PBKDF2-SHA256, 600,000 rounds): without the passphrase it is unreadable, even if someone downloads the file. Visitors see a **Members only**
screen and enter the passphrase once per device. Each clan has its own passphrase. To change it (or remove a member's access), set a new passphrase and publish again.
Note: files you published BEFORE turning this on stay in the repository history; start a fresh repository if that matters.

## Owner access (only you can edit)
Visitors only ever see the published data. The **Data** page is hidden from the menu; open `#/admin` (add `#/admin` to the site address),
enter the passcode from `src/config.js` (**change it!**) and it unlocks on that browser. Publishing needs your private GitHub token,
so nobody else can change what the site shows.

## Weekly routine
1. In your spreadsheet keep four columns: `Week, Event, Player, Score` (Event is `PR` or `SR`;
   Week can be `18Sep`, `2026-W38` or `18/09/2026`; SR scores can be `740B`). Save as **CSV**.
2. Data → *Import scores* → choose the file → check the preview → *Confirm import*.
   New player names are created automatically. Existing scores are never overwritten.
3. Data → **Publish to website**. The site updates for everyone (phones included) in 1 to 2 minutes.
   (One-time setup: paste a GitHub fine-grained token with *Contents: Read and write* for this repo; steps are shown on the page.)

## Kraken (monthly)
Kraken is a monthly event, tracked separately from the weekly PR/SR. Make a CSV with these columns and import it on the Data page
(the site detects it is a Kraken file automatically):

    Month,Player,Rank,Dmg,Sparks
    Sep 2026,Vishhal,1,"5,967.9",1500

Month can be `2026-09`, `Sep 2026` or `September`. Rank is optional (blank = ranked by damage). Dmg and Sparks can be written like `600M`, `3.9M`
or as full numbers (`598,432,100`); they are shown in millions (`598.43M`). If your sheet holds plain numbers that already mean millions
(like `598.4`), tick the "already in millions" box in the import preview.
The Kraken page shows each month's leaderboard with clan total damage and sparks, compares months **only with other Kraken months**,
and charts the monthly trend. A wrongly imported month can be deleted on the Data page and imported again.

## Fixing mistakes
Scores are stored by week, not by file. If you imported the wrong sheet: use the **Undo** bar at the top of the Data page (it reverts the last
import or delete, including players that import created), or on the Weeks list use **Delete PR** / **Delete SR** to remove just that part of a week,
or **Delete week** for both. Kraken months have their own delete. Players left with no scores can be cleaned up with one button.

## Players who left
Data → Players → set status **Left clan (hidden)**. They disappear from every page but their data is kept
(set back to Active to restore). **Delete** erases them and their scores for good.

## Run locally
    npm install
    npm run dev        # http://localhost:5173
    npm run build      # static site in dist/

## Publish free on GitHub Pages
Repo → Settings → Pages → Source: **GitHub Actions**. `.github/workflows/deploy.yml` builds and deploys on every push.

## Change the clan name or colours
- Name: `src/config.js`
- Colours/themes: variables at the top of `src/styles.css`

## Data storage
Imports are stored in your browser (localStorage) until you publish; visitors see `public/data.json`, which *Publish* writes to GitHub. To move to a real database later
(Supabase, Firebase, REST), replace the functions in `src/services/db.js`. The UI only talks to that file.
