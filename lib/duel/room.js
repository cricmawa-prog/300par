import {
    addDoc,
    collection,
    doc,
    getDoc,
    onSnapshot,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { TOTAL_SLOTS } from '../game/positions';

const TOTAL_TURNS = TOTAL_SLOTS * 2; // 22 - each player drafts their own 11

// Safety net for rooms nobody cleans up (abandoned invites or drafts, or a result one player
// never opened): every room and pick carries `deleteAt`, which a Firestore TTL policy on
// `duelRooms` and the `picks` collection group can use to remove them automatically. Normal
// games don't wait for it - see finalizeResult() and markResultSeen().
const CLEANUP_AFTER_MS = 2 * 24 * 60 * 60 * 1000;
const deleteAtFromNow = () => Timestamp.fromMillis(Date.now() + CLEANUP_AFTER_MS);
export const ROOM_TTL_MS = 5 * 60 * 1000;

export function turnUid(turnIndex, firstPickerUid, otherUid) {
    return turnIndex % 2 === 0 ? firstPickerUid : otherUid;
}

export function otherPlayerUid(room, uid) {
    return room.hostUid === uid ? room.guestUid : room.hostUid;
}

export function isRoomExpired(room) {
    return room.status === 'waiting' && Date.now() > room.expiresAt.toMillis();
}

// The player who won the toss and chose to draft first also bats first in the simulation -
// one decision, not two. teamOf()/isSameTeam() let the draft board know whether picks need to
// stay exclusive between the two players (only meaningful when they drafted the same team).
export function teamOf(room, uid) {
    return room.hostUid === uid ? room.hostTeam : room.guestTeam;
}

export function isSameTeam(room) {
    return !!room.guestTeam && room.hostTeam === room.guestTeam;
}

export async function createRoom({ hostUid, hostName, hostTeam, opponentUid, opponentName, ground = null }) {
    const ref = await addDoc(collection(db, 'duelRooms'), {
        hostUid,
        hostName,
        hostTeam,
        guestUid: null,
        guestName: null,
        guestTeam: null,
        opponentUid: opponentUid || null,
        opponentName: opponentName || null,
        ground: ground || null, // optional duel ground (beta); chosen by the host only
        status: 'waiting',
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + ROOM_TTL_MS),
        deleteAt: deleteAtFromNow(),
        tossWinnerUid: null,
        firstPickerUid: null,
        currentTurnIndex: 0,
        resultHost: null,
        resultGuest: null,
        winnerUid: null,
        completedAt: null,
    });
    return ref.id;
}

// Only the host, and only before anyone has joined, can close an open invite.
export async function closeRoom(roomId, requesterUid) {
    const ref = doc(db, 'duelRooms', roomId);
    await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Room not found.');
        const room = snap.data();
        if (room.hostUid !== requesterUid) throw new Error('Only the host can close this room.');
        if (room.status !== 'waiting') throw new Error('This room already has two players.');
        tx.update(ref, { status: 'closed', deleteAt: deleteAtFromNow() });
    });
}

export function subscribeToRoom(roomId, onChange, onError) {
    return onSnapshot(
        doc(db, 'duelRooms', roomId),
        (snap) => {
            onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        },
        onError
    );
}

export function subscribeToPicks(roomId, onChange, onError) {
    const q = query(collection(db, 'duelRooms', roomId, 'picks'), orderBy('turnIndex'));
    return onSnapshot(
        q,
        (snap) => {
            onChange(snap.docs.map((d) => d.data()));
        },
        onError
    );
}

// Guest joining and the coin-flip happen in one transaction so two guests racing to open the
// same link can't both "win" the toss, and so the toss result can't be recomputed/tampered
// with by re-running the join.
export async function joinRoom(roomId, { guestUid, guestName, guestTeam }) {
    const ref = doc(db, 'duelRooms', roomId);
    return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Room not found.');
        const room = snap.data();

        if (room.hostUid === guestUid) throw new Error('You cannot join your own room.');
        if (room.opponentUid && room.opponentUid !== guestUid) {
            throw new Error('This invite is for a different player.');
        }
        if (Date.now() > room.expiresAt.toMillis() && room.status === 'waiting') {
            throw new Error('This invite has expired.');
        }
        // Already joined by THIS player (a retried transaction, a double tap, or an ack that got
        // lost on a shaky connection): the join worked - report success instead of an error.
        if (room.guestUid === guestUid && room.status !== 'waiting') return room.tossWinnerUid;
        if (room.status !== 'waiting') {
            throw new Error('This room already has two players.');
        }

        const tossWinnerUid = Math.random() < 0.5 ? room.hostUid : guestUid;
        tx.update(ref, {
            guestUid,
            guestName,
            guestTeam,
            status: 'toss',
            tossWinnerUid,
        });
        return tossWinnerUid;
    });
}

export async function chooseFirstPicker(roomId, firstPickerUid) {
    const ref = doc(db, 'duelRooms', roomId);
    await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Room not found.');
        const room = snap.data();
        if (room.status !== 'toss') throw new Error('Toss already resolved.');
        tx.update(ref, { status: 'drafting', firstPickerUid, currentTurnIndex: 0 });
    });
}

// One transaction per pick: verifies it's genuinely this uid's turn and this turn hasn't
// already been submitted (guards double-clicks/duplicate turns), writes the pick doc, and
// advances the room to the next turn (or to 'simulating' after the 22nd).
export async function submitPick(roomId, { uid, turnIndex, year, playerName, slot }) {
    const roomRef = doc(db, 'duelRooms', roomId);
    const pickRef = doc(db, 'duelRooms', roomId, 'picks', String(turnIndex));

    await runTransaction(db, async (tx) => {
        const roomSnap = await tx.get(roomRef);
        if (!roomSnap.exists()) throw new Error('Room not found.');
        const room = roomSnap.data();
        if (room.status !== 'drafting') throw new Error('Draft is not active.');
        if (room.currentTurnIndex !== turnIndex) throw new Error('Not this turn.');

        const other = otherPlayerUid(room, room.firstPickerUid);
        const expectedUid = turnUid(turnIndex, room.firstPickerUid, other);
        if (expectedUid !== uid) throw new Error("It isn't your turn.");

        const pickSnap = await tx.get(pickRef);
        if (pickSnap.exists()) throw new Error('This turn was already played.');

        tx.set(pickRef, { uid, turnIndex, year, playerName, slot, pickedAt: Date.now(), deleteAt: deleteAtFromNow() });

        const nextTurn = turnIndex + 1;
        tx.update(roomRef, {
            currentTurnIndex: nextTurn,
            status: nextTurn >= TOTAL_TURNS ? 'simulating' : 'drafting',
        });
    });
}

// Guarded so that whichever client notices "simulating" first is the only one that finalizes -
// the transaction re-checks status === 'simulating' before writing, so a race between both
// players' browsers can't double-submit or overwrite the result. The 22 picks are deleted in
// the same transaction: the results already hold both batting orders, so nothing reads them
// again. The full results stay on the room only until both players have received them.
export async function finalizeResult(
    roomId,
    { hostResult, guestResult, winnerUid, hostUid, guestUid, hostTeam, guestTeam, hostName, guestName, battedFirstUid, ground = null }
) {
    const roomRef = doc(db, 'duelRooms', roomId);
    try {
        await finalizeTransaction();
    } catch (err) {
        // Both browsers simulate and both try to save. The first to commit wins; the second one is
        // refused by the rules on purpose (duelResults/{roomId} already exists and can't be
        // overwritten - that is what stops a second, different random result replacing the first).
        // So a refusal while the room is already complete just means "someone else finished it".
        if (err?.code === 'permission-denied' || err?.code === 'aborted' || err?.code === 'failed-precondition') {
            const latest = await getDoc(roomRef).catch(() => null);
            if (!latest || !latest.exists() || latest.data().status !== 'simulating') return;
        }
        throw err;
    }

    async function finalizeTransaction() {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        // Both players' browsers try to finalise; the loser of that race can arrive after the winner
        // finished AND both players already collected the result and the room was cleaned up.
        // That means "already done", not an error worth showing.
        if (!snap.exists()) return;
        const room = snap.data();
        if (room.status !== 'simulating') return;

        tx.update(roomRef, {
            resultHost: hostResult,
            resultGuest: guestResult,
            winnerUid,
            status: 'complete',
            completedAt: serverTimestamp(),
            seenBy: [],
            deleteAt: deleteAtFromNow(),
        });
        // The dashboard's permanent record is written in THIS transaction (id = roomId), so a
        // finished duel can never exist without its stats row - not even if this browser closes
        // right after - and it can't be written twice.
        tx.set(doc(db, 'duelResults', roomId), {
            participants: [hostUid, guestUid],
            hostUid,
            guestUid,
            hostScore: hostResult.finalScore,
            guestScore: guestResult.finalScore,
            hostWickets: hostResult.wickets,
            guestWickets: guestResult.wickets,
            hostBalls: hostResult.ballsFaced,
            guestBalls: guestResult.ballsFaced,
            hostName,
            guestName,
            battedFirstUid,
            winnerUid,
            hostTeam,
            guestTeam,
            ground: ground || null,
            roomId,
            completedAt: serverTimestamp(),
        });
        for (let i = 0; i < TOTAL_TURNS; i++) {
            tx.delete(doc(db, 'duelRooms', roomId, 'picks', String(i)));
        }
      });
    }
}

// Called by each player's browser once it has the finished room (and has kept its own local
// copy). When the second player checks in, the room - with its ball-by-ball results - is
// deleted. The small `duelResults` summary written above is untouched, so the dashboard keeps
// its history.
export async function markResultSeen(roomId, uid) {
    const ref = doc(db, 'duelRooms', roomId);
    await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const room = snap.data();
        if (room.status !== 'complete' || (uid !== room.hostUid && uid !== room.guestUid)) return;
        const seenBy = Array.from(new Set([...(room.seenBy || []), uid]));
        if (seenBy.includes(room.hostUid) && seenBy.includes(room.guestUid)) {
            tx.delete(ref);
        } else {
            tx.update(ref, { seenBy });
        }
    });
}

export async function getRoomOnce(roomId) {
    const snap = await getDoc(doc(db, 'duelRooms', roomId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
