// Tournament service (server only, firebase-admin). Every state change is one Firestore
// transaction, so double clicks, two players acting at once, or both browsers reporting the same
// result can never double-count or skip a step. Browsers can only READ tournaments (see
// firestore.rules); everything below runs behind /api/tournaments.
//
// Data:
//   tournaments/{tid}                  - name, host, status, players{uid:{name}}, invites{uid:{name,status}},
//                                         accessUids (who may read), seeds/leagueTable/champion once known
//   tournaments/{tid}/fixtures/{fid}   - L01..Lnn league, SF/SF1/SF2 semis, F final
//   tournamentInvites/{tid}_{uid}      - one per invitee, so "my invites" is a single query
//   duelRooms/{roomId}                 - each fixture is played as a normal 1v1 duel room, created here
//                                         with tournamentId/fixtureId; its duelResults summary is the
//                                         source of truth for the fixture result.
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '../firebaseAdmin';
import { HttpError } from './http';
import { mails } from './mailer';
import { MAX_PLAYERS, MIN_PLAYERS, advance, isSettled, resultFromDuel, roundRobin } from '../tournament/format';

const INVITE_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const ROOM_INVITE_MS = 10 * 60 * 1000; // a fixture room waits 10 minutes for the opponent (rules allow <= 10)
const ROOM_CLEANUP_MS = 2 * 24 * 60 * 60 * 1000;
const NUDGE_EVERY_MS = 10 * 60 * 1000;
const MAX_ACTIVE_HOSTED = 3;
const TEAMS = ['SRH', 'RCB', 'CSK', 'MI'];

const db = () => getAdminDb();
const tRef = (tid) => db().doc(`tournaments/${tid}`);
const fRef = (tid, fid) => db().doc(`tournaments/${tid}/fixtures/${fid}`);
const inviteRef = (tid, uid) => db().doc(`tournamentInvites/${tid}_${uid}`);

async function usernames(uids) {
    if (!uids.length) return {};
    const snaps = await db().getAll(...uids.map((u) => db().doc(`users/${u}`)));
    return Object.fromEntries(snaps.filter((s) => s.exists && s.data().username).map((s) => [s.id, s.data().username]));
}

async function membersOnly(uids) {
    const snaps = await db().getAll(...uids.map((u) => db().doc(`members/${u}`)));
    return snaps.filter((s) => s.exists).map((s) => s.id);
}

async function emailOf(uid) {
    try {
        return (await getAdminAuth().getUser(uid)).email || null;
    } catch {
        return null;
    }
}

async function sendInviteEmails(tid, t, uids, url) {
    const failed = [];
    await Promise.all(
        uids.map(async (uid) => {
            const to = await emailOf(uid);
            const res = to ? await mails.tournamentInvite({ to, hostName: t.hostName, tournamentName: t.name, url }) : { sent: false };
            await inviteRef(tid, uid).update({ emailSent: res.sent }).catch(() => {});
            if (!res.sent) failed.push(t.invites?.[uid]?.name || uid);
        })
    );
    return failed;
}

function loadTournament(snap) {
    if (!snap.exists) throw new HttpError(404, 'Tournament not found.');
    return { id: snap.id, ...snap.data() };
}

function requireHost(t, uid) {
    if (t.hostUid !== uid) throw new HttpError(403, 'Only the host can do that.');
}

const pendingUids = (t) => Object.entries(t.invites || {}).filter(([, i]) => i.status === 'pending').map(([u]) => u);
const playerUids = (t) => Object.keys(t.players || {});

function cleanName(name) {
    const n = String(name || '').trim().replace(/\s+/g, ' ');
    if (n.length < 3 || n.length > 40) throw new HttpError(400, 'Tournament name must be 3-40 characters.');
    return n;
}

// ---------- create / invite ----------

export async function createTournament(caller, body, url) {
    const name = cleanName(body.name);
    const wanted = [...new Set((body.inviteeUids || []).filter((u) => typeof u === 'string' && u && u !== caller.uid))];
    if (wanted.length < MIN_PLAYERS - 1) throw new HttpError(400, `Invite at least ${MIN_PLAYERS - 1} players (${MIN_PLAYERS} including you).`);
    if (wanted.length > MAX_PLAYERS - 1) throw new HttpError(400, `At most ${MAX_PLAYERS - 1} invites (${MAX_PLAYERS} players including you).`);

    const active = await db()
        .collection('tournaments')
        .where('hostUid', '==', caller.uid)
        .where('status', 'in', ['inviting', 'league', 'playoffs'])
        .limit(MAX_ACTIVE_HOSTED + 1)
        .get();
    if (active.size >= MAX_ACTIVE_HOSTED) throw new HttpError(400, `You already host ${MAX_ACTIVE_HOSTED} running tournaments. Finish or cancel one first.`);

    const allowed = await membersOnly(wanted);
    const names = await usernames([caller.uid, ...allowed]);
    if (!names[caller.uid]) throw new HttpError(400, 'Pick a username before hosting.');
    const invitees = allowed.filter((u) => names[u]);
    if (invitees.length < wanted.length) throw new HttpError(400, 'Some of those players are no longer in the beta. Search again.');

    const ref = db().collection('tournaments').doc();
    const now = Date.now();
    const t = {
        name,
        hostUid: caller.uid,
        hostName: names[caller.uid],
        status: 'inviting',
        players: { [caller.uid]: { name: names[caller.uid] } },
        invites: Object.fromEntries(invitees.map((u) => [u, { name: names[u], status: 'pending' }])),
        accessUids: [caller.uid, ...invitees],
        qualifiers: null,
        seeds: null,
        leagueTable: null,
        championUid: null,
        runnerUpUid: null,
        fixtureCount: 0,
        createdAt: FieldValue.serverTimestamp(),
        startedAt: null,
        completedAt: null,
    };
    const batch = db().batch();
    batch.set(ref, t);
    for (const uid of invitees) batch.set(inviteRef(ref.id, uid), inviteDoc(ref.id, t, uid, now));
    await batch.commit();
    const emailsFailed = await sendInviteEmails(ref.id, t, invitees, url);
    return { id: ref.id, emailsFailed };
}

function inviteDoc(tid, t, uid, now) {
    return {
        tournamentId: tid,
        tournamentName: t.name,
        hostUid: t.hostUid,
        hostName: t.hostName,
        uid,
        status: 'pending',
        emailSent: false,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(now + INVITE_TTL_MS),
        respondedAt: null,
    };
}

export async function inviteMore(caller, tid, body, url) {
    const wanted = [...new Set((body.inviteeUids || []).filter((u) => typeof u === 'string' && u && u !== caller.uid))];
    if (!wanted.length) throw new HttpError(400, 'Pick someone to invite.');
    const allowed = await membersOnly(wanted);
    const names = await usernames(allowed);
    const now = Date.now();
    const added = await db().runTransaction(async (tx) => {
        const t = loadTournament(await tx.get(tRef(tid)));
        requireHost(t, caller.uid);
        if (t.status !== 'inviting') throw new HttpError(409, 'The tournament has already started.');
        // Declined / expired / left invitees may be asked again; pending or accepted ones are skipped.
        const fresh = allowed.filter((u) => names[u] && !t.players[u] && t.invites?.[u]?.status !== 'pending');
        const seats = MAX_PLAYERS - playerUids(t).length - pendingUids(t).length;
        if (fresh.length > seats) throw new HttpError(400, `Only ${seats} seat${seats === 1 ? '' : 's'} left (max ${MAX_PLAYERS} players).`);
        const patch = { accessUids: FieldValue.arrayUnion(...fresh) };
        for (const u of fresh) {
            patch[`invites.${u}`] = { name: names[u], status: 'pending' };
            tx.set(inviteRef(tid, u), inviteDoc(tid, t, u, now));
        }
        if (fresh.length) tx.update(tRef(tid), patch);
        return { t, fresh };
    });
    const invites = { ...added.t.invites, ...Object.fromEntries(added.fresh.map((u) => [u, { name: names[u] }])) };
    const emailsFailed = await sendInviteEmails(tid, { ...added.t, invites }, added.fresh, url);
    return { invited: added.fresh.length, emailsFailed };
}

export async function resendInvites(caller, tid, url) {
    const t = loadTournament(await tRef(tid).get());
    requireHost(t, caller.uid);
    if (t.status !== 'inviting') throw new HttpError(409, 'The tournament has already started.');
    const emailsFailed = await sendInviteEmails(tid, t, pendingUids(t), url);
    return { emailsFailed };
}

// ---------- respond / start / cancel ----------

// Start = freeze the roster, close leftover invites, write every league fixture. Called inside a
// transaction that has already read `t` (reads must all come before writes). Returns the patch
// for the tournament doc so the caller can merge it into its own single update.
function startWrites(tx, t) {
    const players = playerUids(t);
    if (players.length < MIN_PLAYERS) throw new HttpError(400, `Need at least ${MIN_PLAYERS} players to start (have ${players.length}).`);
    if (players.length > MAX_PLAYERS) throw new HttpError(400, `At most ${MAX_PLAYERS} players.`);
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const fixtures = roundRobin(shuffled);
    for (const f of fixtures) tx.set(fRef(t.id, f.id), { ...f, label: `Match ${Number(f.id.slice(1))}`, status: 'pending', roomId: null, result: null });
    const patch = { status: 'league', startedAt: FieldValue.serverTimestamp(), fixtureCount: fixtures.length };
    for (const u of pendingUids(t)) {
        patch[`invites.${u}.status`] = 'closed';
        tx.update(inviteRef(t.id, u), { status: 'closed' });
    }
    return patch;
}

export async function respondToInvite(caller, tid, accept) {
    return db().runTransaction(async (tx) => {
        const t = loadTournament(await tx.get(tRef(tid)));
        const invSnap = await tx.get(inviteRef(tid, caller.uid));
        if (!invSnap.exists) throw new HttpError(404, 'No invite for you in this tournament.');
        const inv = invSnap.data();
        if (inv.status !== 'pending') {
            if (t.status === 'cancelled') throw new HttpError(409, 'The host cancelled this tournament.');
            if (inv.status === 'closed') throw new HttpError(409, 'This tournament has already started without you.');
            throw new HttpError(409, `This invite is already ${inv.status}.`);
        }
        // Thrown errors roll the transaction back, so stale invites are tidied by returning instead.
        if (t.status !== 'inviting') {
            tx.update(invSnap.ref, { status: 'closed' });
            return { status: 'closed', error: t.status === 'cancelled' ? 'The host cancelled this tournament.' : 'This tournament has already started without you.' };
        }
        if (inv.expiresAt.toMillis() < Date.now()) {
            tx.update(invSnap.ref, { status: 'expired' });
            tx.update(tRef(tid), { [`invites.${caller.uid}.status`]: 'expired' });
            return { status: 'expired', error: 'This invite has expired. Ask the host to invite you again.' };
        }
        if (accept && playerUids(t).length >= MAX_PLAYERS) throw new HttpError(409, 'The tournament is full.');

        const status = accept ? 'accepted' : 'declined';
        const name = t.invites?.[caller.uid]?.name || 'Player';
        tx.update(invSnap.ref, { status, respondedAt: FieldValue.serverTimestamp() });

        const patch = { [`invites.${caller.uid}.status`]: status };
        if (accept) patch[`players.${caller.uid}`] = { name };
        const after = {
            ...t,
            players: accept ? { ...t.players, [caller.uid]: { name } } : t.players,
            invites: { ...t.invites, [caller.uid]: { name, status } },
        };
        // Everyone has answered and there are enough players: start straight away.
        const started = !pendingUids(after).length && playerUids(after).length >= MIN_PLAYERS;
        if (started) Object.assign(patch, startWrites(tx, after));
        tx.update(tRef(tid), patch);
        return { status, started };
    });
}

// A player who accepted can drop out again before the start.
export async function leaveTournament(caller, tid) {
    return db().runTransaction(async (tx) => {
        const t = loadTournament(await tx.get(tRef(tid)));
        if (t.hostUid === caller.uid) throw new HttpError(400, 'The host can cancel the tournament instead.');
        if (!t.players?.[caller.uid]) throw new HttpError(409, "You're not in this tournament.");
        if (t.status !== 'inviting') throw new HttpError(409, 'The tournament has started - ask the host to give your matches as walkovers.');
        tx.update(tRef(tid), { [`players.${caller.uid}`]: FieldValue.delete(), [`invites.${caller.uid}.status`]: 'left' });
        tx.update(inviteRef(tid, caller.uid), { status: 'left' });
        return {};
    });
}

export async function startTournament(caller, tid) {
    return db().runTransaction(async (tx) => {
        const t = loadTournament(await tx.get(tRef(tid)));
        requireHost(t, caller.uid);
        if (t.status !== 'inviting') throw new HttpError(409, 'Already started.');
        const patch = startWrites(tx, t);
        tx.update(tRef(tid), patch);
        return { fixtures: patch.fixtureCount };
    });
}

export async function cancelTournament(caller, tid) {
    return db().runTransaction(async (tx) => {
        const t = loadTournament(await tx.get(tRef(tid)));
        requireHost(t, caller.uid);
        if (!['inviting', 'league', 'playoffs'].includes(t.status)) throw new HttpError(409, `The tournament is already ${t.status}.`);
        const patch = { status: 'cancelled', completedAt: FieldValue.serverTimestamp() };
        for (const u of pendingUids(t)) {
            patch[`invites.${u}.status`] = 'closed';
            tx.update(inviteRef(tid, u), { status: 'closed' });
        }
        tx.update(tRef(tid), patch);
        return {};
    });
}

// ---------- playing fixtures ----------

function assertPlayable(t, f, uid) {
    if (!['league', 'playoffs'].includes(t.status)) throw new HttpError(409, 'This tournament is not running.');
    if (![f.homeUid, f.awayUid].includes(uid)) throw new HttpError(403, "You're not playing in this match.");
    if (isSettled(f)) throw new HttpError(409, 'This match is already decided.');
}

// Opens (or re-opens) the duel room for a fixture and returns its id. Both players can press
// "Play": whoever is first creates the room, the other is sent into the same room. A closed or
// expired room is replaced; a room whose duel finished is reported instead.
export async function playFixture(caller, tid, fid, body, url) {
    const team = body.team;
    const out = await db().runTransaction(async (tx) => {
        const t = loadTournament(await tx.get(tRef(tid)));
        const fSnap = await tx.get(fRef(tid, fid));
        if (!fSnap.exists) throw new HttpError(404, 'Match not found.');
        const f = { id: fSnap.id, ...fSnap.data() };
        assertPlayable(t, f, caller.uid);

        if (f.roomId) {
            const [roomSnap, duelSnap] = await Promise.all([tx.get(db().doc(`duelRooms/${f.roomId}`)), tx.get(db().doc(`duelResults/${f.roomId}`))]);
            if (duelSnap.exists) return { roomId: f.roomId, finished: true };
            if (roomSnap.exists) {
                const room = roomSnap.data();
                const open = room.status === 'waiting' && room.expiresAt.toMillis() > Date.now();
                if (open || ['toss', 'drafting', 'simulating', 'complete'].includes(room.status)) return { roomId: f.roomId };
            }
        }
        if (!TEAMS.includes(team)) return { needTeam: true };

        const opponentUid = f.homeUid === caller.uid ? f.awayUid : f.homeUid;
        const now = Date.now();
        const roomRef = db().collection('duelRooms').doc();
        tx.set(roomRef, {
            hostUid: caller.uid,
            hostName: t.players[caller.uid]?.name || 'Player',
            hostTeam: team,
            guestUid: null,
            guestName: null,
            guestTeam: null,
            opponentUid,
            opponentName: t.players[opponentUid]?.name || 'Player',
            ground: null,
            status: 'waiting',
            createdAt: FieldValue.serverTimestamp(),
            expiresAt: Timestamp.fromMillis(now + ROOM_INVITE_MS),
            deleteAt: Timestamp.fromMillis(now + ROOM_CLEANUP_MS),
            tossWinnerUid: null,
            firstPickerUid: null,
            currentTurnIndex: 0,
            resultHost: null,
            resultGuest: null,
            winnerUid: null,
            completedAt: null,
            tournamentId: tid,
            tournamentName: t.name,
            fixtureId: fid,
            fixtureLabel: f.label || fid,
        });
        const nudge = !f.lastNudgeAt || now - f.lastNudgeAt > NUDGE_EVERY_MS;
        tx.update(fSnap.ref, { status: 'live', roomId: roomRef.id, roomHostUid: caller.uid, roomOpenedAt: now, ...(nudge ? { lastNudgeAt: now } : {}) });
        return { roomId: roomRef.id, created: true, nudge, opponentUid, hostName: t.players[caller.uid]?.name, tournamentName: t.name };
    });

    if (out.finished) {
        await reportFixture(caller, tid, fid);
        return { roomId: out.roomId, finished: true };
    }
    if (out.created && out.nudge) {
        const to = await emailOf(out.opponentUid);
        if (to) mails.matchWaiting({ to, hostName: out.hostName, tournamentName: out.tournamentName, roomUrl: `${url}/300par/duel/${out.roomId}` }).catch(() => {});
    }
    return { roomId: out.roomId, needTeam: !!out.needTeam };
}

// Reads every fixture, applies the settled one, works out what comes next (playoffs, final,
// champion) and writes it all. Must be called after all other reads in the transaction.
async function writeSettlement(tx, t, f, fixturePatch) {
    const all = await tx.get(db().collection(`tournaments/${t.id}/fixtures`));
    const updated = { ...f, ...fixturePatch };
    const fixtures = all.docs.map((d) => (d.id === f.id ? updated : { id: d.id, ...d.data() }));
    const { newFixtures, patch } = advance(t, fixtures);

    tx.update(fRef(t.id, f.id), { ...fixturePatch, completedAt: FieldValue.serverTimestamp() });
    for (const nf of newFixtures) tx.set(fRef(t.id, nf.id), { ...nf, status: 'pending', roomId: null, result: null });
    const tPatch = { ...(patch || {}) };
    if (newFixtures.length) tPatch.fixtureCount = FieldValue.increment(newFixtures.length);
    if (tPatch.status === 'complete') tPatch.completedAt = FieldValue.serverTimestamp();
    if (Object.keys(tPatch).length) tx.update(tRef(t.id), tPatch);
    return { status: updated.status, next: newFixtures.map((x) => x.id), tournamentStatus: tPatch.status || t.status };
}

// Records a fixture's result from its duel. Safe to call any number of times by either player (or
// by anyone in the tournament when the page notices a finished room): the result is read from the
// duelResults record the duel itself wrote, never from the caller.
export async function reportFixture(caller, tid, fid) {
    return db().runTransaction(async (tx) => {
        const t = loadTournament(await tx.get(tRef(tid)));
        if (!t.accessUids?.includes(caller.uid)) throw new HttpError(403, "You're not in this tournament.");
        const fSnap = await tx.get(fRef(tid, fid));
        if (!fSnap.exists) throw new HttpError(404, 'Match not found.');
        const f = { id: fSnap.id, ...fSnap.data() };
        if (isSettled(f)) return { status: f.status };
        if (!['league', 'playoffs'].includes(t.status) || !f.roomId) return { status: f.status };

        const duelSnap = await tx.get(db().doc(`duelResults/${f.roomId}`));
        if (!duelSnap.exists) {
            // The room is gone and never produced a result (abandoned and cleaned up): free the fixture.
            const roomSnap = await tx.get(db().doc(`duelRooms/${f.roomId}`));
            if (!roomSnap.exists) {
                tx.update(fSnap.ref, { status: 'pending', roomId: null, roomHostUid: null });
                return { status: 'pending' };
            }
            return { status: f.status };
        }
        const duel = duelSnap.data();
        const pair = [f.homeUid, f.awayUid].sort().join();
        if ([duel.hostUid, duel.guestUid].sort().join() !== pair) throw new HttpError(409, "That duel wasn't between this match's players.");
        return writeSettlement(tx, t, f, { status: 'complete', result: resultFromDuel(duel) });
    });
}

// Host-only fallback when a match can't be played: walkover (winner gets the points, no NRR effect)
// or, in the league only, no result (1 point each). Knockouts always need a winner.
export async function settleFixture(caller, tid, fid, body) {
    return db().runTransaction(async (tx) => {
        const t = loadTournament(await tx.get(tRef(tid)));
        requireHost(t, caller.uid);
        if (!['league', 'playoffs'].includes(t.status)) throw new HttpError(409, 'This tournament is not running.');
        const fSnap = await tx.get(fRef(tid, fid));
        if (!fSnap.exists) throw new HttpError(404, 'Match not found.');
        const f = { id: fSnap.id, ...fSnap.data() };
        if (isSettled(f)) throw new HttpError(409, 'This match is already decided.');
        if (body.type === 'walkover') {
            if (![f.homeUid, f.awayUid].includes(body.winnerUid)) throw new HttpError(400, 'Pick one of the two players as the winner.');
            return writeSettlement(tx, t, f, { status: 'walkover', result: { winnerUid: body.winnerUid } });
        }
        if (body.type === 'no_result') {
            if (f.stage !== 'league') throw new HttpError(400, 'A knockout match needs a winner - give a walkover instead.');
            return writeSettlement(tx, t, f, { status: 'no_result', result: null });
        }
        throw new HttpError(400, 'Unknown settlement.');
    });
}
