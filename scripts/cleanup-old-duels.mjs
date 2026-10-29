// One-time cleanup of duel data left by games played before rooms/picks were deleted after each
// game (see "Storage cleanup" in app/300par/README.md). Removes, per room:
//   - all `duelRooms/{id}/picks/*` docs once the room is finished, closed, expired or abandoned
//   - the room doc itself (it holds both full ball-by-ball innings)
// Never touches `duelResults` (dashboard history), `leaderboard*` or `users`. A finished room
// whose `duelResults` summary is missing gets that summary written first, so no game disappears
// from anyone's dashboard. Rooms still being played (newer than --older-than-hours) are skipped.
//
// Usage (reads .env.local, same Firebase Admin credentials as the other scripts):
//   node scripts/cleanup-old-duels.mjs                          # dry run - prints what would go
//   node scripts/cleanup-old-duels.mjs --apply                  # deletes
//   node scripts/cleanup-old-duels.mjs --apply --older-than-hours=48
// With FIRESTORE_EMULATOR_HOST set it runs against the local emulator instead (for testing).

import nextEnv from '@next/env';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

nextEnv.loadEnvConfig(process.cwd());

const apply = process.argv.includes('--apply');
const hoursArg = process.argv.find((a) => a.startsWith('--older-than-hours='));
const olderThanMs = (hoursArg ? Number(hoursArg.split('=')[1]) : 24) * 60 * 60 * 1000;
const cutoff = Date.now() - olderThanMs;

const app = process.env.FIRESTORE_EMULATOR_HOST
    ? initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-sunrisers' })
    : initializeApp({
          credential: cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          }),
      });
const db = getFirestore(app);

const millis = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : null);

// Why a room can go, or null to keep it.
function reasonToDelete(room) {
    const created = millis(room.createdAt) ?? 0;
    switch (room.status) {
        case 'complete':
            return (millis(room.completedAt) ?? created) < cutoff ? 'finished' : null;
        case 'closed':
            return 'closed invite';
        case 'waiting':
            return (millis(room.expiresAt) ?? created) < Date.now() ? 'expired invite' : null;
        default: // toss / drafting / simulating
            return created < cutoff ? `abandoned (${room.status})` : null;
    }
}

// Mirrors the summary finalizeResult() writes, for finished rooms that never got one.
function summaryFor(roomId, room) {
    return {
        participants: [room.hostUid, room.guestUid],
        hostUid: room.hostUid,
        guestUid: room.guestUid,
        hostScore: room.resultHost.finalScore,
        guestScore: room.resultGuest.finalScore,
        hostWickets: room.resultHost.wickets,
        guestWickets: room.resultGuest.wickets,
        hostBalls: room.resultHost.ballsFaced,
        guestBalls: room.resultGuest.ballsFaced,
        hostName: room.hostName,
        guestName: room.guestName,
        battedFirstUid: room.firstPickerUid,
        winnerUid: room.winnerUid,
        hostTeam: room.hostTeam,
        guestTeam: room.guestTeam,
        roomId,
        completedAt: room.completedAt || FieldValue.serverTimestamp(),
    };
}

const writer = db.bulkWriter();
const counts = { rooms: 0, picks: 0, summariesAdded: 0, kept: 0, orphanPicks: 0 };
const byReason = {};

const rooms = await db.collection('duelRooms').get();
for (const snap of rooms.docs) {
    const room = snap.data();
    const reason = reasonToDelete(room);
    if (!reason) {
        counts.kept++;
        continue;
    }
    const picks = await snap.ref.collection('picks').get();

    if (room.status === 'complete' && room.resultHost && room.resultGuest) {
        const existing = await db.collection('duelResults').where('roomId', '==', snap.id).limit(1).get();
        if (existing.empty) {
            counts.summariesAdded++;
            console.log(`  + ${snap.id}: adding missing dashboard summary`);
            if (apply) await db.collection('duelResults').add(summaryFor(snap.id, room));
        }
    }

    byReason[reason] = (byReason[reason] || 0) + 1;
    counts.rooms++;
    counts.picks += picks.size;
    console.log(`  - ${snap.id}: ${reason}, ${picks.size} picks`);
    if (apply) {
        picks.docs.forEach((p) => writer.delete(p.ref));
        writer.delete(snap.ref);
    }
}

// Picks whose room is already gone (nothing should read them).
const roomIds = new Set(rooms.docs.map((d) => d.id));
const allPicks = await db.collectionGroup('picks').get();
for (const p of allPicks.docs) {
    const parent = p.ref.parent.parent;
    if (!parent || parent.parent.id !== 'duelRooms' || roomIds.has(parent.id)) continue;
    counts.orphanPicks++;
    if (apply) writer.delete(p.ref);
}

await writer.close();

console.log('');
console.log(apply ? 'Deleted:' : 'Dry run - would delete:');
console.log(`  rooms: ${counts.rooms} ${JSON.stringify(byReason)}`);
console.log(`  picks: ${counts.picks} (+ ${counts.orphanPicks} orphaned)`);
console.log(`  dashboard summaries ${apply ? 'added' : 'to add'} first: ${counts.summariesAdded}`);
console.log(`  rooms kept (still in play / recent): ${counts.kept}`);
if (!apply) console.log('\nRe-run with --apply to delete.');
