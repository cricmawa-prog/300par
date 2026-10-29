# Tournaments + private beta: plan, rules and edge cases

This app is a copy of the srh site's **300 Par** (solo), **1v1 Duel**, leaderboard, dashboard and
Firebase sign-in, moved to its own Firebase project for testing with close friends. On top of that it
adds an invite-only beta (waitlist + admin page) and **round-robin tournaments**.

## 1. Access (private beta)

| Who | How they get in |
|---|---|
| Admins (`ADMIN_EMAILS`, default `rishikeshdevarashetty@gmail.com`, `cricmawa@gmail.com`) | Sign in with that email. They become a member with role `admin` on the spot. |
| Invited by an admin | Admin types their email on `/admin` -> it goes on the allow-list and they get an email. They sign in with that address and are let in. |
| Anyone else | Home page waitlist form (name, email, note) -> shows on `/admin` -> Approve (allow-list + "you're in" email) or Reject. |

- Membership = `members/{uid}`, written **only by the server** (`/api/access`). Firestore rules check
  it for every read/write except username-availability lookups, so an unapproved account can't touch
  anything even by calling Firestore directly.
- Only a **verified** email counts (Google sign-in is verified; email+password users must click the
  verification link first). Otherwise someone could sign up with password as `friend@gmail.com` and
  take their allow-listed spot.
- An admin can remove a member (`/admin` -> Remove): member doc + allow-list entry are deleted and
  their refresh tokens revoked. Admins can't be removed from the page (they come from the env var).

## 2. Tournament lifecycle

```
inviting --(everyone answered & >=4 in, or host presses Start)--> league --> playoffs --> complete
    \__________________________ host cancels at any point ___________________________/--> cancelled
```

1. **Create** (`/tournaments/new`): name + search 3-9 members by username. Host counts as a player, so
   4-10 players. Each invitee gets a `tournamentInvites` doc (shown in-app) and an email (nodemailer).
2. **Invites** are plain DB records, not rooms - nothing stays open while people decide. They last
   3 days. Accept / decline from `/tournaments` or the tournament page.
3. **Start**: automatically the moment the last pending invite is answered (if 4+ accepted), or the
   host presses **Start with N players** any time 4+ are in - leftover pending invites are closed.
   So 7 of 10 accepting -> it starts with 7.
4. **League**: round robin (circle method, random seating) - everyone plays everyone once,
   N(N-1)/2 matches (6 for 4 players ... 45 for 10). Matches are grouped into rounds for display but
   can be played **in any order**. Each match is a normal 1v1 duel room created for that fixture.
5. **Points table**: win 2, loss 0, no result 1. Sorted by points -> **NRR** -> wins -> runs scored
   -> a fixed per-tournament coin flip. A clean two-way tie on points and NRR is decided by
   head-to-head.
6. **Playoffs**:
   - 4 players: top **3** qualify. Semi = 2nd v 3rd, Final = 1st v semi winner.
   - 5-10 players: top **4**. SF1 = 1st v 4th, SF2 = 2nd v 3rd, Final = winners.
7. **Complete**: champion + runner-up shown on the tournament page.

### Net run rate

`NRR = runs scored / overs faced - runs conceded / overs bowled`, summed over all completed league
matches. An all-out innings counts as the full 20 overs (standard rule); a successful chase counts the
balls it actually took. Walkovers and no-results don't count towards NRR. Stored per fixture as
`result.innings[uid] = { runs, wickets, balls, team }`, computed live from fixtures
(`lib/tournament/format.js`), and frozen as `leagueTable` when the league ends.

### Playing a match

- Either player presses **Play** -> picks a franchise -> the server creates the duel room (host = the
  presser, opponent = the other player) and emails the opponent. The opponent sees a live **Join
  match** button on the tournament page (and the email link). The room waits 10 minutes.
- From there it's the normal duel: join + franchise pick, toss, 22-pick draft, simulation, result.
- When the duel finishes, both browsers ask the server to record it. The server reads the result
  from the duel's own `duelResults` record (never from the browser), checks it's between the two
  fixture players and from this fixture's room, and writes it. Then it creates the semis / final or
  crowns the champion in the same transaction.

## 3. Edge cases and how they're handled

**Invites and starting**
| Case | Behaviour |
|---|---|
| Fewer than 3 invitees | Create is refused (need 4 incl. host). |
| More than 9 invitees / inviting past 10 seats | Refused; seats = 10 - joined - pending. |
| Not enough accept (e.g. 2 of 5) | Stays in `inviting`; page says how many more are needed; host can invite more or cancel. |
| Declined / expired / left player | Host can invite them again. Pending or joined players can't be double-invited. |
| Someone answers after the start | Invite is already `closed`: "started without you". |
| Someone answers after cancel | "The host cancelled this tournament." |
| Invite older than 3 days | Marked `expired` when touched; hidden from "my invites". |
| Accepted player wants out before start | **Leave tournament** (their seat frees up). After start: host gives walkovers. |
| Two people accept at the same moment | Each response is a transaction; the auto-start check sees both. |
| Email not configured / fails | Invite still exists in-app; host sees "couldn't email X" and can **Resend emails**. |
| Host spamming tournaments | Max 3 running tournaments per host. |
| Invitee not in the beta | Server only accepts approved members with a username. |

**Matches**
| Case | Behaviour |
|---|---|
| Both players press Play at once | One transaction wins and creates the room; the other is sent to the same room. |
| Opponent never joins (room expires after 10 min) / host closes the room | Pressing Play again opens a fresh room. |
| Draft abandoned halfway | Room stays (2-day TTL); either player can reopen it from the tournament page and continue. |
| Room deleted (TTL) without a result | Next report/Play frees the fixture to `pending`. |
| Both players close the tab right after the result | The result is safe in `duelResults`; the tournament page reports any `live` match on the next visit. |
| Both browsers report the same result | Idempotent - the second report sees the fixture already settled. |
| A normal (non-tournament) duel between the same two players | Doesn't count - only the fixture's own room is accepted. |
| Forged report (duel between other people, or a made-up result doc) | Refused: participants must match; `duelResults` can only be created by the real room flow (rules). |
| Player ghosts / quits mid-league | Host: **Walkover to X** (2 points, no NRR) or **No result** (1 each) on any unplayed league match. |
| Knockout can't be played | Walkover only (a knockout needs a winner). |
| Tied scores in a duel | Can't tie: the chasing side needs target + 1, so level scores = side batting first wins. |
| Odd number of players | One player has a bye each round (display only - matches are in any order anyway). |
| Same franchise for both players | Allowed, as in duels (picks stay exclusive between them). |

**Standings**
| Case | Behaviour |
|---|---|
| Points + NRR exactly level (two players) | Head-to-head winner ranks higher. |
| Three-way dead heat | wins -> runs scored -> deterministic per-tournament coin flip (same on every device). |
| Last league match settled | Same transaction freezes the table and writes the semis - can't be created twice. |

**Cancelling / access**
| Case | Behaviour |
|---|---|
| Host cancels mid-tournament | Status `cancelled`; open rooms just expire. History stays readable. |
| A member is removed by an admin mid-tournament | They lose access; host walkovers their remaining matches. |
| Someone not invited opens the link | Rules refuse it: only the host + people ever invited can read a tournament and its fixtures. |

## 4. Data model

```
members/{uid}                  { uid, email, role: 'admin'|'player', via, approvedAt }       server only
allowlist/{email}              { email, source, addedBy, addedAt }                          server only
waitlist/{email}               { email, name, note, uid?, status: pending|approved|rejected }  server only
tournaments/{tid}              { name, hostUid, hostName, status, players{uid:{name}},
                                 invites{uid:{name,status}}, accessUids[], fixtureCount,
                                 qualifiers, seeds[], leagueTable[], championUid, runnerUpUid,
                                 createdAt, startedAt, completedAt }                        read: host + invitees
tournaments/{tid}/fixtures/{L01..Lnn|SF|SF1|SF2|F}
                               { stage, round?, label, homeUid, awayUid, status: pending|live|
                                 complete|walkover|no_result, roomId, roomHostUid,
                                 result{ winnerUid, battedFirstUid, innings{uid:{runs,wickets,balls,team}} } }
tournamentInvites/{tid}_{uid}  { tournamentId, tournamentName, hostUid, hostName, uid, status,
                                 emailSent, createdAt, expiresAt, respondedAt }             read: the invitee
duelRooms/{roomId}             existing duel room + { tournamentId, tournamentName, fixtureId, fixtureLabel }
```

Browsers never write tournaments, fixtures or invites. Every step is one Firestore transaction in
`lib/server/tournaments.js`, behind `POST /api/tournaments` (create) and
`POST /api/tournaments/[id]` with `action` = `invite | resend | respond | leave | start | cancel |
play | report | settle`.

## 5. Tests

- `npm test` - pure format logic: round robin for 4-10, NRR, table order, ties, playoff progression.
- `npm run test:emulator` - Firestore emulator: two full tournaments (4 and 7 players) through the
  real server code (create -> invites -> auto-start -> league with walkover/no-result -> playoffs ->
  champion), the refusal cases above, and the beta/tournament Firestore rules.

## 6. Known limits / later

- Duel results are still simulated in the players' browsers (same as srh). Rules stop fake games and
  forged pairings, not a player tampering with their own simulation.
- No deadlines: the host decides when to give walkovers. A per-round deadline could be added later.
- Franchise is picked per match (like duels), not fixed per tournament.
