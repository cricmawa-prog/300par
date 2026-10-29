// Tournament format: round-robin league, points table with net run rate, then playoffs.
// Pure functions only (no Firestore) - the API routes use them to write fixtures and the pages
// use them to draw the table, so both always agree. Covered by tests/tournament-format.test.mjs.

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 10; // host included
export const POINTS_WIN = 2;
export const POINTS_NO_RESULT = 1;
export const FULL_INNINGS_BALLS = 120; // 20 overs

// Fixture statuses. 'complete' = a real duel was played; 'walkover' and 'no_result' are set by
// the host and never count towards net run rate.
export const SETTLED = ['complete', 'walkover', 'no_result'];
export const isSettled = (f) => SETTLED.includes(f.status);

// 4 players: top 3 qualify (2nd v 3rd semi, 1st waits in the final). 5+: top 4, 1v4 and 2v3.
export function qualifierCount(playerCount) {
    return playerCount <= 4 ? 3 : 4;
}

// Round robin by the circle method: everyone plays everyone once, spread over rounds so nobody
// plays twice in a round (an odd count gives one player a bye per round). Home/away alternates
// so the same player isn't always listed first. Returns [{ id, stage, round, homeUid, awayUid }].
export function roundRobin(uids) {
    const list = [...uids];
    if (list.length % 2 === 1) list.push(null); // bye
    const n = list.length;
    const fixtures = [];
    let arr = list;
    for (let round = 0; round < n - 1; round++) {
        for (let i = 0; i < n / 2; i++) {
            const a = arr[i];
            const b = arr[n - 1 - i];
            if (a === null || b === null) continue;
            const swap = (round + i) % 2 === 1;
            fixtures.push({ round: round + 1, homeUid: swap ? b : a, awayUid: swap ? a : b });
        }
        // keep the first entry fixed, rotate the rest one step
        arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
    }
    return fixtures.map((f, i) => ({ id: `L${String(i + 1).padStart(2, '0')}`, stage: 'league', ...f }));
}

// Balls an innings counts for in net run rate: an all-out side is charged the full 20 overs
// (standard cricket rule), otherwise the balls actually faced.
export function nrrBalls(innings) {
    if (!innings) return 0;
    return innings.wickets >= 10 ? FULL_INNINGS_BALLS : innings.balls;
}

function emptyRow(uid, name) {
    return { uid, name, played: 0, won: 0, lost: 0, noResult: 0, points: 0, runsFor: 0, ballsFor: 0, runsAgainst: 0, ballsAgainst: 0, nrr: 0 };
}

// Small deterministic hash so a dead-level tie still sorts the same way on every device.
function tieHash(seed, uid) {
    let h = 2166136261;
    const s = `${seed}:${uid}`;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

// players: { [uid]: { name } }, fixtures: any list (only settled league fixtures are counted).
// Order: points, then NRR, then wins, then runs scored, then a fixed per-tournament coin flip.
// A two-way tie on points AND NRR is then settled by head-to-head where the pair has played.
export function computeStandings(players, fixtures, seed = '') {
    const rows = Object.fromEntries(Object.entries(players).map(([uid, p]) => [uid, emptyRow(uid, p.name)]));
    const h2h = {}; // `${winner}>${loser}`
    for (const f of fixtures) {
        if (f.stage !== 'league' || !isSettled(f)) continue;
        const home = rows[f.homeUid];
        const away = rows[f.awayUid];
        if (!home || !away) continue;
        home.played += 1;
        away.played += 1;
        if (f.status === 'no_result') {
            home.noResult += 1;
            away.noResult += 1;
            home.points += POINTS_NO_RESULT;
            away.points += POINTS_NO_RESULT;
            continue;
        }
        const winner = rows[f.result?.winnerUid];
        if (!winner) continue;
        const loser = winner === home ? away : home;
        winner.won += 1;
        winner.points += POINTS_WIN;
        loser.lost += 1;
        h2h[`${winner.uid}>${loser.uid}`] = true;
        if (f.status !== 'complete') continue; // walkovers don't touch NRR
        for (const [me, opp] of [[home, away], [away, home]]) {
            const mine = f.result.innings?.[me.uid];
            const theirs = f.result.innings?.[opp.uid];
            if (!mine || !theirs) continue;
            me.runsFor += mine.runs;
            me.ballsFor += nrrBalls(mine);
            me.runsAgainst += theirs.runs;
            me.ballsAgainst += nrrBalls(theirs);
        }
    }
    const list = Object.values(rows);
    for (const r of list) {
        const forRate = r.ballsFor ? r.runsFor / (r.ballsFor / 6) : 0;
        const againstRate = r.ballsAgainst ? r.runsAgainst / (r.ballsAgainst / 6) : 0;
        r.nrr = Math.round((forRate - againstRate) * 1000) / 1000;
    }
    list.sort(
        (a, b) =>
            b.points - a.points ||
            b.nrr - a.nrr ||
            b.won - a.won ||
            b.runsFor - a.runsFor ||
            tieHash(seed, a.uid) - tieHash(seed, b.uid)
    );
    // head-to-head for exactly-two-way ties on points + NRR
    for (let i = 0; i < list.length - 1; i++) {
        const a = list[i];
        const b = list[i + 1];
        const third = list[i + 2];
        const prev = list[i - 1];
        const level = (x, y) => x && y && x.points === y.points && x.nrr === y.nrr;
        if (!level(a, b) || level(b, third) || level(prev, a)) continue;
        if (h2h[`${b.uid}>${a.uid}`]) {
            list[i] = b;
            list[i + 1] = a;
        }
    }
    return list.map((r, i) => ({ ...r, position: i + 1 }));
}

export function formatNrr(nrr) {
    return `${nrr > 0 ? '+' : ''}${nrr.toFixed(3)}`;
}

export function winnerOf(fixture) {
    return isSettled(fixture) ? fixture.result?.winnerUid || null : null;
}

// What happens after a fixture is settled. Given the tournament and ALL its fixtures (with the
// newly settled one already updated), returns { newFixtures, patch }:
//   - league finished -> playoff fixtures + the frozen league table
//   - semis finished  -> the final
//   - final finished  -> champion, tournament complete
// Idempotent: never re-creates a fixture that already exists.
export function advance(tournament, fixtures) {
    const byId = Object.fromEntries(fixtures.map((f) => [f.id, f]));
    const league = fixtures.filter((f) => f.stage === 'league');
    const none = { newFixtures: [], patch: null };

    if (tournament.status === 'league') {
        if (!league.length || !league.every(isSettled)) return none;
        const table = computeStandings(tournament.players, fixtures, tournament.id || '');
        const seeds = table.map((r) => r.uid);
        const q = qualifierCount(seeds.length);
        const newFixtures =
            q === 3
                ? [{ id: 'SF', stage: 'semi', label: 'Semi-final (2nd v 3rd)', homeUid: seeds[1], awayUid: seeds[2] }]
                : [
                      { id: 'SF1', stage: 'semi', label: 'Semi-final 1 (1st v 4th)', homeUid: seeds[0], awayUid: seeds[3] },
                      { id: 'SF2', stage: 'semi', label: 'Semi-final 2 (2nd v 3rd)', homeUid: seeds[1], awayUid: seeds[2] },
                  ];
        return {
            newFixtures: newFixtures.filter((f) => !byId[f.id]),
            patch: { status: 'playoffs', qualifiers: q, seeds: seeds.slice(0, q), leagueTable: table },
        };
    }

    if (tournament.status === 'playoffs') {
        const final = byId.F;
        if (final) {
            if (!isSettled(final)) return none;
            const champ = winnerOf(final);
            return { newFixtures: [], patch: { status: 'complete', championUid: champ, runnerUpUid: champ === final.homeUid ? final.awayUid : final.homeUid } };
        }
        const seeds = tournament.seeds || [];
        if (tournament.qualifiers === 3) {
            const sf = byId.SF;
            if (!sf || !isSettled(sf)) return none;
            return { newFixtures: [{ id: 'F', stage: 'final', label: 'Final', homeUid: seeds[0], awayUid: winnerOf(sf) }], patch: null };
        }
        const sf1 = byId.SF1;
        const sf2 = byId.SF2;
        if (!sf1 || !sf2 || !isSettled(sf1) || !isSettled(sf2)) return none;
        return { newFixtures: [{ id: 'F', stage: 'final', label: 'Final', homeUid: winnerOf(sf1), awayUid: winnerOf(sf2) }], patch: null };
    }

    return none;
}

// A duel's stored summary (duelResults doc) -> the fixture result shape used above.
export function resultFromDuel(duel) {
    const side = (host) => ({
        runs: host ? duel.hostScore : duel.guestScore,
        wickets: host ? duel.hostWickets : duel.guestWickets,
        balls: host ? duel.hostBalls : duel.guestBalls,
        team: host ? duel.hostTeam : duel.guestTeam,
    });
    return {
        winnerUid: duel.winnerUid,
        battedFirstUid: duel.battedFirstUid,
        innings: { [duel.hostUid]: side(true), [duel.guestUid]: side(false) },
        roomId: duel.roomId,
    };
}
