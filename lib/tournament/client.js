import { collection, doc, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';

// Browser-side reads for tournaments (all writes go through /api/tournaments). Each is a live
// listener; a tournament is at most 1 doc + 48 fixtures, so this stays cheap.

const millis = (t) => (t?.toMillis ? t.toMillis() : 0);

export function subscribeToMyInvites(uid, onChange, onError) {
    const q = query(collection(db, 'tournamentInvites'), where('uid', '==', uid), where('status', '==', 'pending'), limit(20));
    return onSnapshot(
        q,
        (snap) => {
            const now = Date.now();
            onChange(
                snap.docs
                    .map((d) => ({ id: d.id, ...d.data() }))
                    .filter((i) => millis(i.expiresAt) > now)
                    .sort((a, b) => millis(b.createdAt) - millis(a.createdAt))
            );
        },
        onError
    );
}

// Every tournament you were ever invited to or host; the page filters to the ones you're in.
export function subscribeToMyTournaments(uid, onChange, onError) {
    const q = query(collection(db, 'tournaments'), where('accessUids', 'array-contains', uid), limit(30));
    return onSnapshot(
        q,
        (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => millis(b.createdAt) - millis(a.createdAt))),
        onError
    );
}

export function subscribeToTournament(id, onChange, onError) {
    return onSnapshot(doc(db, 'tournaments', id), (snap) => onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null), onError);
}

const STAGE_ORDER = { league: 0, semi: 1, final: 2 };

export function subscribeToFixtures(id, onChange, onError) {
    return onSnapshot(
        collection(db, 'tournaments', id, 'fixtures'),
        (snap) =>
            onChange(
                snap.docs
                    .map((d) => ({ id: d.id, ...d.data() }))
                    .sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || (a.round || 0) - (b.round || 0) || a.id.localeCompare(b.id))
            ),
        onError
    );
}

export const STATUS_LABEL = {
    inviting: 'Waiting for players',
    league: 'League stage',
    playoffs: 'Playoffs',
    complete: 'Finished',
    cancelled: 'Cancelled',
};
