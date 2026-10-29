# 300 Par

Fan-made draft-and-simulate game, inspired by [500-0.com](https://500-0.com). Pick an IPL
franchise, draft its 11-player XI from across its history (one random season offered per
turn), then simulate a 20-over chase. No IPL team has ever scored 300 in a T20 innings —
hitting it here is meant to be rare (roughly a 1-in-5 shot with a genuinely elite historical
draft, near-zero with a weak one).

Fully client-side. No Firestore/backend involved — game state lives in React state during
a run, and only a lightweight history/best-score gets written to `localStorage`.

Currently playable: **SRH** (2013-2026), **RCB** (2008-2026), **CSK** (2008-2015 and
2018-2026 — banned for 2016-2017 over the spot-fixing scandal, so those two years are
deliberately absent, not a data gap), **MI** (2008-2026, no gaps). Adding a team is a data
task, not a code task — see "Adding a new team" below.

## File map

| File | Role |
|---|---|
| `data/teams/index.js` | Team registry — `{ code, name, founded, lastYear }`. Add a team here once its JSON exists |
| `data/teams/SRH.json`, `data/teams/RCB.json`, `data/teams/CSK.json`, `data/teams/MI.json` | Static per-team datasets: real per-season players with ratings and slot eligibility |
| `data/playerStats/*.csv`, `scripts/build-squads-from-stats.mjs` | **Source of truth for the datasets.** Real per-season stats, turned into `data/teams/<CODE>.json` |
| `lib/game/ratingFormula.mjs` | Shared BAT/POW/BWL formula used by the squad build script — one place to change the scale for all teams |
| `lib/data/seasonSquads.js` | Loader: `getTeams()`, `getSeasonSquads(teamCode)`, `getSquadForYear(teamCode, year)` |
| `lib/game/positions.js` | Batting-order slot labels (1-11) + slot-eligibility helpers |
| `lib/game/simulate.js` | Pure function `simulateChase(battingOrder)` — the ball-by-ball chase sim |
| `lib/game/localHistory.js` | `localStorage` helpers: run history, best score, one-time login-prompt flag |
| `app/300par/page.js` | Server component, loads every registered team's season data, renders `DraftGame` |
| `components/Game/DraftGame.js` | Client component, the whole team-select + draft state machine |
| `components/Game/SeasonPlayerCard.js` | One player's draft card (ratings, disabled states) |
| `components/Game/BattingOrderStrip.js` | The 11-slot lineup strip, highlights eligible slots |
| `components/Game/ScoreBoard.js` | Post-simulation result screen |
| `components/Game/LoginNudgeModal.js` | One-time-per-session "sign in?" nudge after a result |

## Data: where the numbers come from

Each `data/teams/<CODE>.json` is **generated** from real per-season stats in
`data/playerStats/` (`<team>_batters_stats.csv`, `<team>_bowling_stats.csv`, plus a
`<team>_notes.md` with method and source notes). Those stats are Cricsheet ball-by-ball
aggregates cross-checked against published tables, so every rating is sourced - nothing is
estimated, and a player who didn't play a season is absent from that season's squad. To
change data, edit the CSVs and regenerate all four teams:

```bash
node scripts/build-squads-from-stats.mjs
```

The CSVs only carry stats. Country, role, batting slots and the keeper flag come from the
previous dataset where the player already existed, otherwise from the `FOREIGN` / `KEEPERS` /
`OPENERS` lists at the top of the build script (or are inferred from the stats). Slots are a
judgement call, not a sourced number - worth a glance when adding new players.

The old hand-typed `scripts/gen-<team>-squads.mjs` generators are superseded and no longer
used (their data was partly estimated).


**A caught bug worth knowing about**: Zaheer Khan was initially (wrongly) placed on RCB for
five seasons (2008, 2010-2013) — he was actually at Mumbai Indians that entire span (his
MI 2010 figures here are exact-sourced). The cross-team collision check below caught it
when MI was added; all five RCB entries were replaced with real players from those years'
actual rosters. This is exactly the failure mode the checklist step exists to catch — a
plausible-sounding name inserted into a `player()` list without being traced back to an
actual roster fetch for *that specific team, that specific year*.

**Roster depth**: every season is padded to **at least 14 real players** (currently 14-15
each), sourced from Wikipedia's full squad-roster tables (name/nationality/role), not just
the handful with published match stats. Depth players without individual stats use
conservative, role-appropriate estimates (e.g. a specialist bowler gets a modest bowling
average/economy, not an invented heroic one) with low `innings`/`wkts` so the rating
formula's small-sample dampening pulls them toward a moderate baseline rather than an
extreme rating in either direction — this is meant to read as "honestly uncertain/fringe,"
not fabricated. If a team's real squad genuinely had fewer than 14 players who ever got
picked, that's a signal to research harder before padding with names, not to invent players.

**Verified for internal consistency** before shipping: no player appears on two different
teams in the same real season (a physical impossibility - one bug of this kind was caught
and fixed, a name that had been guessed onto both SRH's and RCB's 2025 roster), and spot
checks of the highest-rated entries per team traced back to their sourced figures. If you
add a name and get it wrong, this is the class of bug to watch for - grep the *other*
team's file for the same name/year before trusting an addition.

### Rating formulas (`lib/game/ratingFormula.mjs`)

Three ratings per player-season, all roughly 0-100, shared by every team's generator so the
scale stays comparable across franchises:

**BAT** (survival / wicket-preservation) — from batting average:
```
BAT = 20 + average × 1.15
```
Small samples (< 4 innings) are dampened 70/30 toward a neutral baseline (32) so one fluke
knock doesn't produce an extreme rating. Clamped to [15, 96].

**POW** (scoring power) — from strike rate:
```
POW = (strikeRate - 60) × 0.9
```
Same < 4-innings dampening (60/40 toward 45). Clamped to [15, 98].

**BWL** (bowling quality) — only computed for players with ≥3 wickets that season and
`primary: true` (i.e. a real bowling contributor, not a part-timer's occasional over).
Everyone else gets a flat `8 + wkts×2` capped at 25.
```
ecoScore = (11 - economy) / 5.5 × 100
avgScore = (50 - bowlingAverage) / 36 × 100
BWL = 0.5 × ecoScore + 0.5 × avgScore, +4 bonus if wkts >= 15
```
Small wicket samples (< 8 wickets) are dampened 60/40 toward a baseline of 40 — this
matters: a part-time bowler's 3-5 wickets at a good average would otherwise falsely read
as "elite bowler." Clamped to [20, 95].

Pure batsmen have `BWL: 0`. All three ratings are hand-tunable per player by editing the
raw `{ avg, sr, innings }` / `{ avg, eco, wkts, primary }` inputs in the generator scripts.

## Slots & position eligibility (`lib/game/positions.js`)

11 fixed batting-order slots, each with a label and an eligible-role set baked into each
player's `slots` array in the dataset (not derived at runtime):

| Slot | Label | Typical eligible roles |
|---|---|---|
| 1-2 | Opener | Openers, some top-order |
| 3 | One-down | Top/middle order |
| 4-5 | Middle order | Middle order, batting all-rounders, flexible keepers |
| 6-7 | Finisher | Finishers, all-rounders, flexible keepers |
| 8 | Bowling all-rounder | Bowling all-rounders |
| 9-11 | Bowler | Specialist bowlers |

A player's `slots` array is an explicit list of slot numbers they can fill (e.g. a pure
opener is `[1,2]`; a flexible keeper like Klaasen or AB de Villiers is `[2,3,4,5,6,7]`).
The draft UI only lets you place a picked player into an empty slot that's in their `slots`
array — `eligibleEmptySlots()` / `isPlayerPickable()` in `positions.js` do this filtering,
so illegal placement is prevented mechanically rather than validated after the fact.

## Draft rules (enforced in `DraftGame.js`)

- **Choose a team first.** If more than one team is registered, a dropdown gates the draft
  (skipped automatically if only one team exists). "Change Team" mid-draft resets the run.
- 11 turns. Each turn shows one random season's squad; pick one player into any of their
  still-empty eligible slots.
- A player already picked, or with no eligible empty slot left, shows disabled.
- **Max 4 overseas players** (`MAX_FOREIGNERS`) — once hit, all foreign-flagged
  (`country !== 'India'`) players grey out for the rest of the draft.
- **One free "Skip Year"** per game — rerolls the current turn's random year without
  spending a pick. Disabled after first use, resets on Play Again.
- Bowler count (slots 8-11) and keeper-picked status are shown as a soft, non-blocking
  info readout — not hard-enforced. If you want to hard-enforce "must have exactly 1
  keeper" or "must have exactly 4 bowlers," that's the place to add it.

### Deadlock prevention

A turn can, in principle, land on a year where every player is already disabled — already
picked, out of eligible slots, or foreigner-capped (RCB's foreign-heavy, thin early-era
rosters hit this in testing). If that year is also offered *after* the free skip is spent,
the player would be stuck with no legal move. To prevent this, **every year the game offers
is pre-filtered to years with at least one legal pick** (`pickPlayableYear()` in
`DraftGame.js`, backed by `yearIsPlayable()`), checked against the picks/slots/foreigner-cap
state at that exact moment — on initial load, after every pick, on skip, and on Play Again.
A deck this size should never run out of playable years before 11 picks are in, but the
function falls back to the unfiltered year pool if it ever does, rather than crashing.
Verified with a 2000-iteration randomized-draft stress test against both SRH and RCB data
(zero deadlocks) before shipping — worth re-running the same kind of check after adding a
new team, especially one with a small early-era roster.

## Simulation (`lib/game/simulate.js`)

Rating-based, not a pairwise player-vs-player lookup table — deliberately simpler than
literal historical chemistry, per the original design tradeoff. `simulateChase(battingOrder)`
takes the 11 picked players **in slot order** (index 0 = slot 1) and returns:

```js
{ batsmen, overSummaries, totalRuns, extras, finalScore, wickets, oversUsed, ballsFaced, target, won }
```

**Per ball**, for the current striker:
1. Dismissal check:
   `dismissalChance(BAT) = clamp((0.078 - BAT/100 × 0.058) × dismissMult, dismissFloor, dismissCeil)`,
   rolled against `Math.random()`. The multiplier and bounds come from the difficulty setting
   (`DIFFICULTY` in `simulate.js`):

   | Difficulty | `dismissMult` | `dismissFloor` | `dismissCeil` | `powerBoost` | `dotBias` |
   |---|---|---|---|---|---|
   | Hard | 0.80 | 0.017 | 0.064 | 1.06 | 0 |
   | Easy | 0.56 | 0.012 | 0.047 | 1.17 | 0 |
   | Duel (both innings of a duel) | 0.80 | 0.017 | 0.064 | 0.88 | 0.035 |

   On Hard, elite BAT (~96) → ~1.8% chance/ball (about one wicket every 56 balls), BAT 90 →
   ~2.1%, tail-ender (~20) → ~5.3%/ball (about one wicket every 19 balls). Easy is about 30%
   lower across the board (BAT 90 → ~1.4%, BAT 20 → ~3.7%). With BAT clamped to 15-96 the
   floor and ceiling never actually clip today; they are safety bounds. In duels the result
   is multiplied again by the opposition-bowling factor (±10% at the extremes).
2. If not out: runs come from `ballRuns(POW, pairSynergy, rng, powerBoost, dotBias)` — a
   weighted random pick over `{0,1,2,3,4,6}` where the weight on 4s/6s scales with `POW`
   (times the difficulty's `powerBoost`), `dotBias` adds extra weight to the dot ball (duel
   scoring and the struggle rule below; 0 otherwise), and a small **partnership synergy** multiplier (`pairSynergy`, the current striker+non-striker's
   combined BAT+POW average, clamped to 0.85-1.2×). This is the "who's batting with whom"
   effect the original brief asked for, kept intentionally lightweight rather than a full
   pairwise table.
3. Odd runs rotate strike; end of over always rotates strike.
4. A wicket brings in the next player in slot order; 10 wickets ends the innings early
   (remaining players marked `dnb: true`).

**Extras**: a strong bowling unit earns extras (wides, no-balls, byes, leg-byes) —
`budget = max(0, round((avgBWL(slots 8-11) - 50) / 50 × 15))`. The budget is split into small
chunks and dropped on random mid-innings balls (balls 8-105), riding on a normal delivery as
`extras`/`extraType` on that ball-log entry (not credited to the batter, deferred past wicket
balls). So the ball-by-ball score, scorecard (batters + Extras row) and final score always
agree: `finalScore = totalRuns` (batter runs + extras). `won = finalScore >= target`.
(This replaced an end-of-innings "bowler morale" bonus that made the final score differ from
the last ball-log score, and could go negative.) The duel's second innings passes
`stopAtTarget` so the chase ends the ball the target is reached.

**Struggle (very weak batting sides)**: `battingQuality(order)` = mean `(BAT + POW) / 2` over
slots 1-7. Below `STRUGGLE.threshold` (45) a struggle factor ramps from 0 at the threshold to 1
at `STRUGGLE.floor` (20, about the worst XI the real franchise data can produce). At full
strength it adds `dotBias` 0.45 to the dot ball and raises the dismissal chance by 20%. A
self-drafted XI lands around 66-83 (the best-on-offer draft never went below ~54 in a
1000-draft check), so normal teams are untouched: at struggle 0 every probability is
unchanged and no extra random numbers are drawn, which keeps seeded results byte-identical to
before the rule existed. Effect on each franchise's worst-ever XI (Hard): median ~170 → ~115,
about 90% of runs land in 60-140, roughly 1 in 10 still gets past 140 and none passed 200 in
20,000 runs. A merely bad draft (quality ~37) gets a smaller nudge (median ~193 → ~165).

**Duel scoring**: duels are about beating the other side, not reaching 300, so both innings
use the `duel` difficulty row above instead of `hard`. Solo Hard/Easy are unchanged. Measured
over 40,000 simulated duels between draft-style XIs from all four franchises:

| | Hard (before) | Duel |
|---|---|---|
| 1st innings p10 / median / p90 | 227 / 265 / 304 | 206 / 240 / 276 |
| 300+ first innings | ~1 in 8 duels | ~1 in 50 duels |
| Chasing side wins | ~50% | ~50% |
| Top-quartile XI beats bottom-quartile XI | ~77% | ~75% |

The opposition-bowling nudge, extras and the no-keeper penalty apply in duels exactly as
before. A median near 230 and a 300 about once in 50 can't both be hit with this rule: lowering
the middle pulls the tail down with it, so the tuning favours the 1-in-50 tail and lands the
median near 240.

Every call is stochastic (`Math.random()` by default, but the function accepts an
injectable `rng` for testing) — **the same XI in the same slots will score differently
every time you simulate.** Ratings set odds, not outcomes; this is intentional (see commit
history for the design discussion) — not a bug to "fix" without a deliberate product call.

### Difficulty calibration

The `ballRuns` weight coefficients were hand-tuned so that a genuinely elite real-history XI
(e.g. peak Warner/Head/Klaasen/Bhuvneshwar/Rashid for SRH, or peak Kohli/Gayle/de
Villiers/Chahal for RCB) wins **~20%** of simulations, a merely good draft **<1%**, and a
weak early-era draft **~0%**. The formula and its tuning are team-agnostic (it only reads
BAT/POW/BWL off whatever `battingOrder` it's given), so this calibration should hold for
any new team using the same rating scale — but re-check it if a new team's rating
distribution looks unusually high or low compared to SRH/RCB. Quick way to check:

```js
import { simulateChase } from './lib/game/simulate.js';
let wins = 0, n = 500;
for (let i = 0; i < n; i++) if (simulateChase(someEliteXI).won) wins++;
console.log(wins / n); // target ~0.20 for an elite XI
```

## Persistence (`lib/game/localHistory.js`)

`localStorage` only, key `srh300par:history` — capped list of the last 20 runs
(`{ score, wickets, won, team, xi, timestamp }`). `getBestScore()` reads from it (currently
best-across-all-teams; scope it by `team` if per-team bests are wanted later). No login
gate exists on solo play — it was removed along with the one-time sign-in nudge modal that
used to show after a result (see commit history); solo mode has zero auth dependency.

## Adding a new team

1. Research that team's real per-season stats (Wikipedia `20XX <Team> season` pages are the
   best first stop; fall back to ESPNcricinfo/IPLT20stats/web search for years with thin
   Wikipedia tables — expect this, most franchises don't have full tables for every year).
2. Write `scripts/gen-<code>-squads.mjs`, modeled on `gen-rcb-squads.mjs`: import
   `makePlayer` from `lib/game/ratingFormula.mjs`, define a `seasons` object keyed by year,
   `console.log(JSON.stringify(seasons, null, 2))` at the bottom. Aim for **>=14 real
   players per season** — pull the full squad-roster table (not just the stats table) from
   each year's Wikipedia page to find enough real depth names.
3. `node scripts/gen-<code>-squads.mjs > data/teams/<CODE>.json`
4. Add the team to `data/teams/index.js`.
5. Import the new JSON and add it to `TEAM_DATA` in `lib/data/seasonSquads.js`.
6. Sanity-check before calling it done:
   - Run a quick script like the stress test described above against the new team's JSON —
     thin/foreign-heavy rosters are exactly what triggers deadlocks (see "Deadlock prevention").
   - Confirm every season has >=14 entries.
   - Grep the new team's player names against every other team's file, year by year, for
     same-season collisions (a player can't be on two teams in one real season) — see
     "Roster depth" above for the bug this caught during RCB's addition.

## 1v1 Duel (`app/300par/duel/`)

A second, separate mode: two signed-in users draft their own XIs from the same team's
history in alternating turns (22 picks total), then their innings are compared head-to-head
(the second team chases the first team's actual score, not a fixed 300). Unlike solo mode,
this **requires a backend** — real-time turn sync between two browsers and a user directory
to find an opponent. Full design/decisions/data-model are in the plan this was built from;
this section documents what's actually shipped as it lands, phase by phase.

**Why Firestore, not a new realtime vendor**: this app already has Firebase wired in
(`lib/firebase.js`). Firestore's free tier has no hard concurrent-connection ceiling (the
limit is a daily read/write quota, which comfortably covers this app's realistic scale) and
avoids running a second user-identity system alongside Clerk. See git history around this
feature's introduction for the fuller comparison against Supabase Realtime.

**Status: Phases 1-2 shipped and verified.** User directory, full room lifecycle
(create/join/toss), alternating 22-turn draft sync, dual simulation, and a dashboard are all
live. Firestore rules are published (open rules for `users`/`duelRooms`/`duelRooms/{id}/picks`/
`duelResults`, alongside the pre-existing `matches`/`news` rules). A full transaction-level
flow test (room create → join/toss race guards → all 22 picks → dual `simulateChase` →
concurrent `finalizeResult` race) passed against the live rules; only a composite index
(below) and a manual two-browser UI pass remain.

### Phase 1 — user directory

- `app/api/webhooks/clerk/route.js` — verifies the request via `@clerk/nextjs/webhooks`'s
  `verifyWebhook()` (reads `CLERK_WEBHOOK_SIGNING_SECRET`), and on a `user.created` event
  writes `{ displayName, displayNameLower, photoURL, createdAt }` to Firestore
  `users/{clerkUserId}` via the Admin SDK. Configure this URL in the Clerk Dashboard →
  Webhooks once deployed (needs a real public URL — a local dev server can't receive it
  without a tunnel). Only fires for *new* sign-ups; existing users need a one-time backfill
  (see `scripts/` git history for the throwaway script used to do this once — it wasn't kept
  in the repo since it embeds no secrets but has no reason to be run twice).
- `lib/firebaseAdmin.js` — server-only Admin SDK init (`getAdminDb()`), reads
  `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` (from a Firebase
  service-account key — Project Settings → Service Accounts → Generate new private key,
  free, same project/quota as everything else).
- `lib/data/users.js` — `getOpponentCandidates()`, a **client-SDK** read of `users`,
  `orderBy('createdAt', 'desc').limit(200)`, fetched once per page visit.
- `components/Duel/OpponentList.js` — renders that list, filters/searches **entirely
  client-side** (debounced 200ms for UI smoothness only — zero additional Firestore reads
  per keystroke). Revisit only if the user base grows past a few hundred and fetch-all stops
  being cheap; the upgrade path is a server-side prefix-range query on `displayNameLower`.

### Phase 2 — room lifecycle, draft sync, dual simulation, dashboard

- `lib/duel/room.js` — every state transition is a Firestore transaction: `createRoom`,
  `joinRoom` (also computes the coin-flip toss atomically, so two guests racing to open the
  same link can't both "win" it), `chooseFirstPicker`, `submitPick` (checks it's genuinely
  this uid's turn and this turn index hasn't already been played — guards double-clicks and
  turn-order violations), `finalizeResult` (checks `status` is still `'simulating'` before
  writing, so if both clients race to finalize, only the first one's write sticks — the
  loser's locally-computed result is discarded, and that client picks up the authoritative
  result via its existing `onSnapshot` subscription instead of trusting its own computation).
- Picks are **exclusive across the whole room** — once either player has drafted a given
  player-season, the other can't also draft it (`allPickedNames` in
  `components/Duel/DuelDraftBoard.js` is built from *all* picks, not just the current
  player's). This was a judgment call, not explicitly specified — it's what makes watching
  the opponent's picks matter strategically instead of two isolated solo drafts running side
  by side.
- `pickPlayableYear()`/`yearIsPlayable()` moved from being private to `DraftGame.js` into
  `lib/game/positions.js` as shared exports — both solo mode and `DuelDraftBoard.js` need the
  exact same "don't offer a year with zero legal picks" logic, and it needs to stay identical
  between them rather than drift as two copies.
- `simulateChase()` (`lib/game/simulate.js`) gained a third, optional `target` param
  (defaults to `300`, solo mode's call sites are unchanged) — the room page runs it twice:
  once for the host with the default target, once for the guest with `target =
  hostResult.finalScore`, so `won` on the guest's result IS the duel's win condition.
- `components/Duel/TossPanel.js`, `DuelDraftBoard.js` (reuses `SeasonPlayerCard` +
  `BattingOrderStrip` from solo mode, shows both players' boards live), `DuelResult.js`
  (reuses `LivePlayback` twice in sequence — host's innings, then guest's chasing it — then a
  winner banner).
- `app/300par/duel/[roomId]/page.js` — the room itself, one big phase switch on
  `room.status`: `waiting` (join or share-link view, `isRoomExpired()` gates a stale invite)
  → `toss` → `drafting` → `simulating` (exactly one client's browser actually runs the
  simulation, guarded by a `useRef` so it only attempts once per page load; `finalizeResult`
  is what actually decides whose result "wins" the race) → `complete`.
- `lib/data/duelResults.js` + `app/dashboard/page.js` — `duelResults` queried by
  `where('participants', 'array-contains', uid)`. New "Dashboard" nav link in
  `components/Navbar.js`, shown only when signed in.

### Storage cleanup — finished duels don't stay in Firestore

Only the small `duelResults` summary (~0.5 KB, what the dashboard reads) is kept for good.
Everything heavy is transient:

| Data | Size | Removed when |
|---|---|---|
| `duelRooms/{id}/picks/*` (22 docs) | ~3-4 KB | In the same `finalizeResult` transaction that saves the result - the results already hold both batting orders |
| `duelRooms/{id}` with both full innings (ball-by-ball) | ~26 KB | `markResultSeen()`: each player's browser checks in once it has the finished room; the second check-in deletes the room |
| `duelResults/{id}` | ~0.5 KB | Never (dashboard history) |

Each browser keeps its own copy of the finished room in `localStorage`
(`lib/duel/localResults.js`, key `duelRoom:{id}`), so the result screen and replay still work
after the room is gone - including mid-replay, when the other player's check-in deletes it. Local
copies expire after 3 days and are capped at 10 (oldest dropped first), so they never grow
large enough to slow the page. After that, the room link shows a "replay cleared - see your
dashboard" message.

**Safety net (one-time console setup):** every room and pick carries a `deleteAt` timestamp (2
days out; refreshed when a game completes or an invite is closed). To clean up rooms nobody
finishes - abandoned invites, abandoned drafts, or a result one player never opens - add two
TTL policies in Firebase console → Firestore → TTL: collection group `duelRooms`, field
`deleteAt`; and collection group `picks`, field `deleteAt`. (TTL deletes only the document it's
on, never subcollections - which is why picks get their own field and policy.) Without the
policies, normal games still clean up after themselves; only abandoned rooms would linger.

**Old games (one-time):** rooms and picks from games played before this change have no
`deleteAt`, so neither the cleanup above nor TTL touches them. `scripts/cleanup-old-duels.mjs`
removes them: picks and room docs for finished games, closed or expired invites, and drafts
abandoned more than `--older-than-hours` (default 24) ago, plus any orphaned picks. Rooms still
in play are skipped. It never touches `duelResults`, `leaderboard*` or `users`, and if a finished
room is missing its `duelResults` summary it writes one first so the game stays on the
dashboard. Dry run by default:
```
node scripts/cleanup-old-duels.mjs            # lists what would be deleted
node scripts/cleanup-old-duels.mjs --apply    # deletes (Firebase Admin creds from .env.local)
```

### Rules — published, with one regression caught and fixed

Confirmed empirically (not just "no rules file exists") that an unauthenticated Firestore
client read/write to a brand-new collection was denied, and critically, **Clerk sessions
never populate Firestore's `request.auth`** (no Clerk↔Firebase-Auth bridge in this app), so a
rule written as `if request.auth != null` would deny every request from this app, signed in or
not. Consistent with the client-trusted model, the new collections got open rules:
```
match /users/{uid} { allow read, write: if true; }
match /duelRooms/{roomId} {
  allow read, write: if true;
  match /picks/{turnIndex} { allow read, write: if true; }
}
match /duelResults/{id} { allow read, write: if true; }
```
First publish accidentally dropped the pre-existing `matches`/`news` rules (`npm run build`
caught this — both pages failed static prerender with `permission-denied`). Re-published with
`matches`/`news` open rules restored alongside the new ones; a follow-up probe confirmed reads
succeed on all five collections and `npm run build` is clean.

### Still open

- **Composite index** for the dashboard's query (`array-contains` + `orderBy` on a different
  field always needs one). The first time `getDuelPage()` runs against live data with
  enough rows to trip it, Firestore throws an error containing a direct console link to create
  the exact index needed — click it once, no manual configuration.
- **Manual two-browser UI pass** (join via shared link, real toss/draft/result UI end to end)
  — the transaction logic itself is verified (see Status above), but nobody has clicked
  through the actual pages with two signed-in accounts yet.

## Likely future enhancements

- Hard-enforce squad composition (exactly 1 keeper, exactly 4 bowlers) instead of the
  current soft readout.
- Re-source the weak-confidence years (noted above, per team) with exact stats once fuller
  tables are published.
- Expand rosters beyond ~13-15 players/season if more real contributors surface.
- Leaderboard for solo mode (would need a backend — still explicitly out of scope for solo
  play, which stays local-only by design; the 1v1 Duel mode above is a separate, deliberately
  backend-dependent feature and doesn't change this).
- Ball-by-ball commentary feed using `overSummaries` (currently computed but unused in the UI).
- Per-team theming (logo, accent color) — currently every team uses the site's fixed
  orange/dark theme; `data/teams/index.js` would be the place to add a `color` field.

## Leaderboard (300+ scores)

`/300par/leaderboard` ranks players who scored 300 or more in solo mode, filterable by **Today /
All time**, **Highest score / Most 300s** and **Hard / Easy**. Playing never needs an account; a
signed-in player's 300+ is saved automatically at the result screen, and a signed-out player is
offered "Sign in to save" - the score is parked in `localStorage` (`lib/game/pendingScore.js`) and
saved by `components/Game/PendingScoreSaver.js` as soon as they sign in.

Storage (`lib/data/leaderboard.js`) is one small doc per player per board, only ever written on a 300+:

- `leaderboard/{difficulty}/entries/{uid}` - all-time best score/wickets/balls + `count300`
- `leaderboardDaily/{date}_{difficulty}/entries/{uid}` - the same for one day (India time)

A view reads at most 25 docs and sorts by a single field, so no composite index is needed. Rules
are open like the rest of the app (client-trusted); add to the Firestore rules:

```
match /leaderboard/{difficulty}/entries/{uid} { allow read, write: if true; }
match /leaderboardDaily/{key}/entries/{uid} { allow read, write: if true; }
```

## Authentication (Firebase Auth - replaced Clerk)

Sign-in is Firebase Auth: Google, plus email + password (`app/signin`, `app/signup`,
`app/signup/username`). Code lives in `lib/auth/` (`AuthProvider` exposes `useUser` /
`SignedIn` / `SignedOut` in the same shape the app used before; `actions.js` has sign-in,
sign-up, username claiming and friendly error text) and `components/Auth/`. The public profile
is `users/{uid}` (`username`, `displayName`, `photoURL`, `createdAt`); usernames are unique
case-insensitively via `usernames/{lower}` (claimed in a transaction). Anyone signed in without
a username (e.g. a new Google sign-up) is sent to `/signup/username` by `ProfileGate`.

Why: Clerk's development instance caps at 100 users and its production instance needs a custom
domain (not `*.vercel.app`). Firebase Auth works on `vercel.app` (add the domain under
Authentication -> Settings -> Authorized domains).

**Migration of existing users** (done once, Clerk left untouched as a fallback):

1. `node scripts/backup-data.mjs` - read-only snapshot of every Firestore doc + every Clerk user
   to `backups/<timestamp>/` (git-ignored, contains personal data).
2. `node scripts/import-clerk-users.mjs [--csv clerk-export.csv] [--apply]` - copies each Clerk user
   into Firebase Auth **with the same uid** (the Clerk id), so every duel result / leaderboard
   row / user doc keeps pointing at the right person. Google accounts are imported Google-linked;
   password accounts keep their password when the Clerk dashboard CSV export (it contains the
   bcrypt hashes) is supplied, otherwise they use "Forgot password". Dry run by default; existing
   Firebase accounts are never overwritten. Also reserves every username in `usernames/`.

`firestore.rules` holds rules that use `request.auth` (the old open rules can't, since Clerk never
populated it). Publish them only after Firebase sign-in is verified on the deployed site.
`app/api/webhooks/clerk` and `lib/clerkAppearance.js` are gone - there is no sign-up webhook any more.

## Duel grounds (beta, behind a switch)

`NEXT_PUBLIC_STADIUMS_ENABLED=true` turns on grounds for 1v1 duels; unset / `false` keeps the
feature closed (no picker, no ground on rooms, standard duel logic). The value is baked in at
build time, so redeploy after changing it on Vercel.

- The host optionally picks one of four grounds in the duel lobby (`components/Duel/GroundPicker.js`,
  images in `public/stadiums/`); the joiner only sees its name. No pick = default logic.
- `lib/game/grounds.js` holds each ground's four numbers: `powerScale` / `dotBias` / `dismissScale`
  move every batter's scoring together (ratings and batting logic are untouched), and `bowlWeight`
  multiplies the existing opposition-bowling effect. `simulateChase(..., ground)` applies them.
- The ground is one extra field on the room and on the finished-duel record - no extra Firestore
  reads/writes, no rules change. Old rooms/results without it behave as "no ground".
- Re-tune with `node scripts/ground-calibrate.mjs` (prints average score and the weak-vs-strong
  attack swing per ground). Current results: averages ~252 / 233 / 183 / 266 and attack swings
  ~12 / 16 / 27 / 12 runs for Hyderabad / Mumbai / Chennai / Bengaluru (default logic: ~253 / ~10).

## Security model

The Firebase web config is public, so anyone can sign up and call Firestore directly with a valid
token, ignoring the UI. **`firestore.rules` is therefore the real defence** and is covered by an
emulator test (`scripts/rules-test`, ~110 checks: the real duel flow end to end + attacks such as a
third person reading/joining a duel, out-of-turn picks, forged results, leaderboard spam, username
takeover, news defacement, directory scraping). Re-run it after any change to the rules or to
`lib/duel/room.js` / `lib/data/*`:

```bash
npx firebase-tools emulators:exec --only firestore --project demo-srh "node scripts/rules-test/run.mjs"
```

What the rules enforce: duel rooms and picks are readable only by their two players (no listing); a
room moves through fixed steps (join -> toss -> draft -> simulate -> complete) and each step may only
touch its own fields; a pick must be the current turn by the right player; a finished-duel record can
only exist for a real room in the right state; leaderboard rows are shaped, bounded (300-500), +1 per
write and 40 s apart; profiles can only carry a username the user has reserved; news is read-only
from browsers. `/api/news` accepts only Firebase ID tokens whose uid is in `ADMIN_UIDS`.

Other hardening: security headers in `next.config.js`, same-site-only post-login redirects, optional
App Check (`NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, then enforce it in the Firebase console).

**Deploying changes to the rules:** ship the matching code first, confirm the deploy, then publish the
rules (the old code writes duel results in a way the new rules refuse).

**Known limit:** duel and solo results are computed in the players' browsers. The rules stop forged
records for games that never happened and out-of-turn play, but a determined cheater can still submit
a believable result or choose any player/season for a pick. Closing that means running the roll and
the simulation on the server (an API route using firebase-admin).
