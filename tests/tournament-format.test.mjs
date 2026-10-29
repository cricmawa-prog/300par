import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roundRobin, computeStandings, advance, nrrBalls, qualifierCount, resultFromDuel } from '../lib/tournament/format.js';

const uids = (n) => Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i)); // A, B, C...
const playersOf = (list) => Object.fromEntries(list.map((u) => [u, { name: u }]));

function played(id, home, away, winner, hr, ar, extra = {}) {
    return {
        id, stage: 'league', homeUid: home, awayUid: away, status: 'complete',
        result: { winnerUid: winner, innings: { [home]: hr, [away]: ar } }, ...extra,
    };
}

test('round robin: everyone plays everyone exactly once, nobody twice in a round', () => {
    for (let n = 4; n <= 10; n++) {
        const fx = roundRobin(uids(n));
        assert.equal(fx.length, (n * (n - 1)) / 2, `n=${n}`);
        const pairs = new Set(fx.map((f) => [f.homeUid, f.awayUid].sort().join('-')));
        assert.equal(pairs.size, fx.length, `no duplicate pairings n=${n}`);
        const rounds = {};
        for (const f of fx) {
            assert.notEqual(f.homeUid, f.awayUid);
            rounds[f.round] ??= new Set();
            for (const u of [f.homeUid, f.awayUid]) {
                assert.ok(!rounds[f.round].has(u), `n=${n} ${u} twice in round ${f.round}`);
                rounds[f.round].add(u);
            }
        }
        assert.equal(new Set(fx.map((f) => f.id)).size, fx.length);
    }
});

test('NRR: all-out innings counts as 20 overs', () => {
    assert.equal(nrrBalls({ runs: 150, wickets: 10, balls: 90 }), 120);
    assert.equal(nrrBalls({ runs: 201, wickets: 4, balls: 100 }), 100);
});

test('standings: points, NRR, walkover and no-result handling', () => {
    const p = playersOf(['A', 'B', 'C', 'D']);
    const fx = [
        // A 240/5 (120) beats B 200/10 (100 balls -> charged 120)
        played('L01', 'A', 'B', 'A', { runs: 240, wickets: 5, balls: 120 }, { runs: 200, wickets: 10, balls: 100 }),
        // C chases 181 in 102 balls vs D 180/7
        played('L02', 'C', 'D', 'C', { runs: 181, wickets: 3, balls: 102 }, { runs: 180, wickets: 7, balls: 120 }),
        { id: 'L03', stage: 'league', homeUid: 'A', awayUid: 'C', status: 'walkover', result: { winnerUid: 'C' } },
        { id: 'L04', stage: 'league', homeUid: 'B', awayUid: 'D', status: 'no_result' },
        { id: 'L05', stage: 'league', homeUid: 'A', awayUid: 'D', status: 'pending' },
    ];
    const t = computeStandings(p, fx, 'seed');
    const row = Object.fromEntries(t.map((r) => [r.uid, r]));
    assert.equal(row.C.points, 4);
    assert.equal(row.A.points, 2);
    assert.equal(row.B.points, 1);
    assert.equal(row.D.points, 1);
    assert.equal(row.A.played, 2);
    // A: 240/20 - 200/20 = +2.000 (walkover ignored)
    assert.equal(row.A.nrr, 2);
    assert.equal(row.B.nrr, -2);
    // C: 181/17 - 180/20 = 10.647 - 9 = 1.647
    assert.equal(row.C.nrr, 1.647);
    assert.deepEqual(t.map((r) => r.uid), ['C', 'A', 'D', 'B']);
    assert.deepEqual(t.map((r) => r.position), [1, 2, 3, 4]);
});

test('standings: two-way tie on points and NRR goes to head-to-head', () => {
    const wo = (id, home, away, winnerUid) => ({ id, stage: 'league', homeUid: home, awayUid: away, status: 'walkover', result: { winnerUid } });
    // A and D both finish on 2 points with NRR 0; D beat A, so D must rank above A whatever the seed.
    const fx = [wo('L01', 'D', 'A', 'D'), wo('L02', 'A', 'C', 'A'), wo('L03', 'B', 'C', 'B'), wo('L04', 'B', 'D', 'B')];
    for (const seed of ['x', 'y', 'z', 'seed-4', 'another']) {
        const order = computeStandings(playersOf(['A', 'B', 'C', 'D']), fx, seed).map((r) => r.uid);
        assert.deepEqual(order, ['B', 'D', 'A', 'C'], `seed ${seed}`);
    }
});

test('standings: dead-level ties sort the same way every time', () => {
    const p = playersOf(uids(6));
    const a = computeStandings(p, [], 'tour1').map((r) => r.uid);
    const b = computeStandings(p, [], 'tour1').map((r) => r.uid);
    assert.deepEqual(a, b);
});

test('qualifiers: 4 players -> 3, otherwise 4', () => {
    assert.equal(qualifierCount(4), 3);
    for (let n = 5; n <= 10; n++) assert.equal(qualifierCount(n), 4);
});

function settleAll(fixtures, pickWinner) {
    return fixtures.map((f) => ({ ...f, status: 'walkover', result: { winnerUid: pickWinner(f) } }));
}

test('advance: 4 players -> 2v3 semi, then 1 v semi winner final, then champion', () => {
    const list = uids(4);
    const tour = { id: 't', status: 'league', players: playersOf(list) };
    // A beats everyone, B beats C and D, C beats D -> A, B, C, D
    const rank = { A: 0, B: 1, C: 2, D: 3 };
    let fx = settleAll(roundRobin(list), (f) => (rank[f.homeUid] < rank[f.awayUid] ? f.homeUid : f.awayUid));

    let step = advance(tour, fx);
    assert.equal(step.patch.status, 'playoffs');
    assert.equal(step.patch.qualifiers, 3);
    assert.deepEqual(step.patch.seeds, ['A', 'B', 'C']);
    assert.deepEqual(step.newFixtures.map((f) => [f.id, f.homeUid, f.awayUid]), [['SF', 'B', 'C']]);

    Object.assign(tour, step.patch);
    fx = [...fx, ...step.newFixtures.map((f) => ({ ...f, status: 'pending' }))];
    assert.deepEqual(advance(tour, fx), { newFixtures: [], patch: null }, 'nothing until the semi is played');

    fx = fx.map((f) => (f.id === 'SF' ? { ...f, status: 'complete', result: { winnerUid: 'C' } } : f));
    step = advance(tour, fx);
    assert.deepEqual(step.newFixtures.map((f) => [f.id, f.homeUid, f.awayUid]), [['F', 'A', 'C']]);

    fx = [...fx, { ...step.newFixtures[0], status: 'complete', result: { winnerUid: 'C' } }];
    step = advance(tour, fx);
    assert.deepEqual(step.patch, { status: 'complete', championUid: 'C', runnerUpUid: 'A' });
});

test('advance: 7 players -> top 4, 1v4 and 2v3, then final', () => {
    const list = uids(7);
    const rank = Object.fromEntries(list.map((u, i) => [u, i]));
    const tour = { id: 't', status: 'league', players: playersOf(list) };
    let fx = roundRobin(list);
    // not finished -> nothing
    assert.equal(advance(tour, fx).patch, null);
    fx = settleAll(fx, (f) => (rank[f.homeUid] < rank[f.awayUid] ? f.homeUid : f.awayUid));
    let step = advance(tour, fx);
    assert.equal(step.patch.qualifiers, 4);
    assert.deepEqual(step.newFixtures.map((f) => [f.id, f.homeUid, f.awayUid]), [['SF1', 'A', 'D'], ['SF2', 'B', 'C']]);
    Object.assign(tour, step.patch);
    fx = [...fx, ...step.newFixtures.map((f) => ({ ...f, status: 'complete', result: { winnerUid: f.awayUid } }))];
    step = advance(tour, fx);
    assert.deepEqual(step.newFixtures.map((f) => [f.id, f.homeUid, f.awayUid]), [['F', 'D', 'C']]);
    // re-running before the final is played creates nothing new
    fx = [...fx, { ...step.newFixtures[0], status: 'pending' }];
    assert.deepEqual(advance(tour, fx).newFixtures, []);
});

test('resultFromDuel maps a duel summary to both innings', () => {
    const r = resultFromDuel({
        hostUid: 'A', guestUid: 'B', hostScore: 210, guestScore: 211, hostWickets: 6, guestWickets: 2,
        hostBalls: 120, guestBalls: 110, hostTeam: 'SRH', guestTeam: 'MI', winnerUid: 'B', battedFirstUid: 'A', roomId: 'r1',
    });
    assert.deepEqual(r.innings.A, { runs: 210, wickets: 6, balls: 120, team: 'SRH' });
    assert.deepEqual(r.innings.B, { runs: 211, wickets: 2, balls: 110, team: 'MI' });
    assert.equal(r.winnerUid, 'B');
});
