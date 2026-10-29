// End-to-end check of the tournament server logic and the Firestore rules, against the Firestore
// emulator (no real project touched). Run:
//   npx firebase-tools emulators:exec --only firestore --project demo-par "node --import ./scripts/emulator-test/register.mjs scripts/emulator-test/run.mjs"
// Duels themselves aren't drafted here: each fixture's duel is faked by writing the room +
// duelResults docs the real duel would leave behind, then reported through the real service.
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';
process.env.FIREBASE_PROJECT_ID = 'demo-par';
process.env.FIREBASE_CLIENT_EMAIL = 'test@demo-par.iam.gserviceaccount.com';
process.env.FIREBASE_PRIVATE_KEY = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });

const { getAdminDb } = await import('../../lib/firebaseAdmin.js');
const svc = await import('../../lib/server/tournaments.js');
const { HttpError } = await import('../../lib/server/http.js');
const { computeStandings } = await import('../../lib/tournament/format.js');

const db = getAdminDb();
let checks = 0;
const ok = (cond, msg) => {
    assert.ok(cond, msg);
    checks++;
};
async function rejects(promise, status, msg) {
    try {
        await promise;
    } catch (err) {
        assert.ok(err instanceof HttpError, `${msg}: expected HttpError, got ${err}`);
        assert.equal(err.status, status, `${msg}: ${err.message}`);
        checks++;
        return err;
    }
    assert.fail(`${msg}: expected a ${status} rejection`);
}

const URL_ = 'http://localhost:3000';
const caller = (uid) => ({ uid });

async function seedUsers(uids) {
    const batch = db.batch();
    for (const uid of uids) {
        batch.set(db.doc(`members/${uid}`), { uid, role: 'player', email: `${uid}@x.test` });
        batch.set(db.doc(`users/${uid}`), { username: uid, usernameLower: uid, displayName: uid, photoURL: null, createdAt: new Date() });
    }
    await batch.commit();
}

const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// Stand-in for a finished duel between the fixture's two players.
async function fakeDuel(tid, fid, hostUid, winnerHint) {
    const t = (await db.doc(`tournaments/${tid}`).get()).data();
    const f = (await db.doc(`tournaments/${tid}/fixtures/${fid}`).get()).data();
    const opp = f.homeUid === hostUid ? f.awayUid : f.homeUid;

    const first = await svc.playFixture(caller(hostUid), tid, fid, {}, URL_);
    ok(first.needTeam, 'play without a team asks for one');
    const opened = await svc.playFixture(caller(hostUid), tid, fid, { team: 'SRH' }, URL_);
    ok(opened.roomId, 'room opened');
    const again = await svc.playFixture(caller(opp), tid, fid, { team: 'MI' }, URL_);
    ok(again.roomId === opened.roomId, 'opponent pressing Play lands in the same room');

    const winner = winnerHint || (Math.random() < 0.5 ? hostUid : opp);
    const firstRuns = rand(160, 260);
    const battedFirstUid = hostUid;
    const hostWon = winner === hostUid;
    const duel = {
        participants: [hostUid, opp],
        hostUid,
        guestUid: opp,
        hostScore: firstRuns,
        hostWickets: rand(3, 10),
        hostBalls: 120,
        guestScore: hostWon ? firstRuns - rand(1, 40) : firstRuns + rand(1, 5),
        guestWickets: hostWon ? 10 : rand(2, 8),
        guestBalls: hostWon ? rand(100, 119) : rand(90, 119),
        hostName: hostUid,
        guestName: opp,
        battedFirstUid,
        winnerUid: winner,
        hostTeam: 'SRH',
        guestTeam: 'MI',
        ground: null,
        roomId: opened.roomId,
        completedAt: new Date(),
    };
    await db.doc(`duelRooms/${opened.roomId}`).update({ status: 'complete', guestUid: opp, winnerUid: winner });
    await db.doc(`duelResults/${opened.roomId}`).set(duel);
    const r1 = await svc.reportFixture(caller(hostUid), tid, fid);
    const r2 = await svc.reportFixture(caller(opp), tid, fid); // both browsers report
    ok(r1.status === 'complete' && r2.status === 'complete', 'report is idempotent');
    return { t, winner };
}

async function runTournament(n, label) {
    const uids = Array.from({ length: n + 1 }, (_, i) => `${label}${i}`); // last one declines
    await seedUsers(uids);
    const [host, ...rest] = uids;

    await rejects(svc.createTournament(caller(host), { name: 'Tiny', inviteeUids: rest.slice(0, 2) }, URL_), 400, 'needs 3+ invites');
    await rejects(svc.createTournament(caller(host), { name: 'x', inviteeUids: rest }, URL_), 400, 'name too short');
    const { id: tid } = await svc.createTournament(caller(host), { name: `${label} cup`, inviteeUids: rest }, URL_);
    let t = (await db.doc(`tournaments/${tid}`).get()).data();
    ok(t.status === 'inviting' && Object.keys(t.invites).length === n, 'tournament created with invites');

    await rejects(svc.startTournament(caller(host), tid), 400, 'cannot start with 1 player');
    await rejects(svc.startTournament(caller(rest[0]), tid), 403, 'only host starts');
    await rejects(svc.respondToInvite(caller('nobody'), tid, true), 404, 'stranger has no invite');

    // everyone but the last accepts; the last declines -> auto start
    for (const u of rest.slice(0, -1)) {
        const out = await svc.respondToInvite(caller(u), tid, true);
        ok(out.status === 'accepted' && !out.started, `${u} accepted`);
    }
    await rejects(svc.respondToInvite(caller(rest[0]), tid, true), 409, 'cannot answer twice');
    const last = await svc.respondToInvite(caller(rest.at(-1)), tid, false);
    ok(last.status === 'declined' && last.started, 'last answer auto-starts the tournament');

    t = (await db.doc(`tournaments/${tid}`).get()).data();
    const players = Object.keys(t.players);
    ok(players.length === n && t.status === 'league', `league with ${n} players`);
    await rejects(svc.inviteMore(caller(host), tid, { inviteeUids: [rest.at(-1)] }, URL_), 409, 'no invites after start');

    let fixtures = (await db.collection(`tournaments/${tid}/fixtures`).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    ok(fixtures.length === (n * (n - 1)) / 2, 'full round robin written');

    const outsider = rest.at(-1);
    await rejects(svc.playFixture(caller(outsider), tid, fixtures[0].id, { team: 'SRH' }, URL_), 403, "declined player can't play");
    await rejects(svc.settleFixture(caller(fixtures[0].homeUid === host ? fixtures[0].awayUid : fixtures[0].homeUid), tid, fixtures[0].id, { type: 'no_result' }), 403, 'only host settles');

    // a duel between the wrong people can't be reported for this fixture
    const f0 = fixtures[0];
    const room = await svc.playFixture(caller(f0.homeUid), tid, f0.id, { team: 'CSK' }, URL_);
    await db.doc(`duelResults/${room.roomId}`).set({ hostUid: f0.homeUid, guestUid: outsider, participants: [f0.homeUid, outsider], winnerUid: f0.homeUid, hostScore: 1, guestScore: 0, roomId: room.roomId });
    await rejects(svc.reportFixture(caller(f0.homeUid), tid, f0.id), 409, 'forged pairing refused');
    await db.doc(`duelResults/${room.roomId}`).delete();
    await db.doc(`duelRooms/${room.roomId}`).update({ status: 'closed' });

    // league: one walkover + one no-result by the host, everything else played
    const [wo, nr, ...played] = fixtures;
    await svc.settleFixture(caller(host), tid, wo.id, { type: 'walkover', winnerUid: wo.awayUid });
    await svc.settleFixture(caller(host), tid, nr.id, { type: 'no_result' });
    await rejects(svc.settleFixture(caller(host), tid, nr.id, { type: 'no_result' }), 409, 'cannot settle twice');
    for (const f of played) await fakeDuel(tid, f.id, f.homeUid);

    t = (await db.doc(`tournaments/${tid}`).get()).data();
    fixtures = (await db.collection(`tournaments/${tid}/fixtures`).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    const table = computeStandings(t.players, fixtures, tid);
    const q = n === 4 ? 3 : 4;
    ok(t.status === 'playoffs' && t.qualifiers === q, `playoffs with top ${q}`);
    ok(JSON.stringify(t.seeds) === JSON.stringify(table.slice(0, q).map((r) => r.uid)), 'seeds match the points table');
    ok(table.reduce((s, r) => s + r.points, 0) === (fixtures.filter((f) => f.stage === 'league').length - 1) * 2 + 2, 'points add up (2 per match, NR 1+1)');

    const semis = fixtures.filter((f) => f.stage === 'semi');
    if (q === 3) {
        ok(semis.length === 1 && semis[0].homeUid === t.seeds[1] && semis[0].awayUid === t.seeds[2], '4 players: 2nd v 3rd semi');
        await rejects(svc.settleFixture(caller(host), tid, 'SF', { type: 'no_result' }), 400, 'knockout needs a winner');
        await fakeDuel(tid, 'SF', semis[0].homeUid, semis[0].awayUid);
        const final = (await db.doc(`tournaments/${tid}/fixtures/F`).get()).data();
        ok(final.homeUid === t.seeds[0] && final.awayUid === semis[0].awayUid, 'final: 1st v semi winner');
    } else {
        const sf1 = semis.find((f) => f.id === 'SF1');
        const sf2 = semis.find((f) => f.id === 'SF2');
        ok(sf1.homeUid === t.seeds[0] && sf1.awayUid === t.seeds[3] && sf2.homeUid === t.seeds[1] && sf2.awayUid === t.seeds[2], '1v4 and 2v3');
        await fakeDuel(tid, 'SF1', sf1.homeUid, sf1.homeUid);
        ok(!(await db.doc(`tournaments/${tid}/fixtures/F`).get()).exists, 'no final until both semis are done');
        await svc.settleFixture(caller(host), tid, 'SF2', { type: 'walkover', winnerUid: sf2.awayUid });
        const final = (await db.doc(`tournaments/${tid}/fixtures/F`).get()).data();
        ok(final.homeUid === sf1.homeUid && final.awayUid === sf2.awayUid, 'final between the semi winners');
    }
    const final = (await db.doc(`tournaments/${tid}/fixtures/F`).get()).data();
    const { winner } = await fakeDuel(tid, 'F', final.homeUid);
    t = (await db.doc(`tournaments/${tid}`).get()).data();
    ok(t.status === 'complete' && t.championUid === winner, 'champion crowned');
    await rejects(svc.playFixture(caller(final.homeUid), tid, 'F', { team: 'SRH' }, URL_), 409, 'finished tournament is closed');
    return { tid, host, uids };
}

const four = await runTournament(4, 'f');
await runTournament(7, 's');

// cancel + invites closing
await seedUsers(['c0', 'c1', 'c2', 'c3', 'c4']);
const { id: cid } = await svc.createTournament(caller('c0'), { name: 'Cancel me', inviteeUids: ['c1', 'c2', 'c3', 'c4'] }, URL_);
await svc.respondToInvite(caller('c1'), cid, true);
await svc.leaveTournament(caller('c1'), cid);
ok(!(await db.doc(`tournaments/${cid}`).get()).data().players.c1, 'player can leave before start');
await svc.inviteMore(caller('c0'), cid, { inviteeUids: ['c1'] }, URL_);
ok((await db.doc(`tournaments/${cid}`).get()).data().invites.c1.status === 'pending', 'left player can be re-invited');
await svc.cancelTournament(caller('c0'), cid);
const lateErr = await rejects(svc.respondToInvite(caller('c2'), cid, true).then((o) => { if (o.error) throw new HttpError(409, o.error); return o; }), 409, 'answering a cancelled tournament');
ok(/cancelled/.test(lateErr.message), 'says cancelled');
ok((await db.doc(`tournamentInvites/${cid}_c3`).get()).data().status === 'closed', 'pending invites closed on cancel');

// ---------- rules (client SDK as specific users) ----------
const { initializeApp } = await import('firebase/app');
const fs = await import('firebase/firestore');
function clientAs(uid) {
    const app = initializeApp({ projectId: 'demo-par', apiKey: 'x' }, `c-${uid}-${Math.random()}`);
    const cdb = fs.getFirestore(app);
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
    fs.connectFirestoreEmulator(cdb, host, Number(port), { mockUserToken: { user_id: uid, sub: uid } });
    return cdb;
}
async function denied(p, msg) {
    try {
        await p;
    } catch (err) {
        assert.equal(err.code, 'permission-denied', `${msg}: ${err.code}`);
        checks++;
        return;
    }
    assert.fail(`${msg}: expected permission-denied`);
}
async function allowed(p, msg) {
    await p;
    checks++;
}
const outsiderDb = clientAs('stranger'); // signed in, not a member
await denied(fs.getDoc(fs.doc(outsiderDb, 'users', 'f0')), 'non-member cannot read profiles');
await denied(fs.getDoc(fs.doc(outsiderDb, 'tournaments', four.tid)), 'non-member cannot read tournaments');
await allowed(fs.getDoc(fs.doc(outsiderDb, 'members', 'stranger')), 'anyone may check their own membership');
await denied(fs.setDoc(fs.doc(outsiderDb, 'members', 'stranger'), { role: 'admin' }), 'cannot make yourself a member');

const p1 = clientAs('f1');
await allowed(fs.getDoc(fs.doc(p1, 'tournaments', four.tid)), 'player reads own tournament');
await allowed(fs.getDocs(fs.collection(p1, 'tournaments', four.tid, 'fixtures')), 'player reads fixtures');
await allowed(fs.getDocs(fs.query(fs.collection(p1, 'tournaments'), fs.where('accessUids', 'array-contains', 'f1'), fs.limit(30))), 'my tournaments query');
await allowed(fs.getDocs(fs.query(fs.collection(p1, 'tournamentInvites'), fs.where('uid', '==', 'f1'), fs.where('status', '==', 'pending'), fs.limit(20))), 'my invites query');
await denied(fs.getDocs(fs.query(fs.collection(p1, 'tournamentInvites'), fs.limit(20))), "can't list everyone's invites");
await denied(fs.updateDoc(fs.doc(p1, 'tournaments', four.tid), { championUid: 'f1' }), 'cannot edit a tournament from the browser');
await denied(fs.setDoc(fs.doc(p1, 'tournaments', four.tid, 'fixtures', 'L01'), { status: 'complete' }), 'cannot edit fixtures');
await denied(fs.getDoc(fs.doc(clientAs('s1'), 'tournaments', four.tid)), "member of another tournament can't read this one");
await denied(fs.getDoc(fs.doc(p1, 'waitlist', 'a@b.c')), 'waitlist is server-only');

console.log(`\nAll ${checks} checks passed.`);
process.exit(0);
