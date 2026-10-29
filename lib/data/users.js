import { collection, documentId, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase';

// Current display names (username-first) for a set of uids, so old saved duels show the player's
// present name without rewriting history. Returns { uid: displayName }; unknown uids are omitted.
// Looked up with batched "in" queries (up to 30 ids per round trip) and remembered for the
// session, so paging through history never re-reads a name it already has.
const nameCache = new Map();

export async function getDisplayNames(uids) {
    const wanted = [...new Set(uids.filter(Boolean))];
    const missing = wanted.filter((uid) => !nameCache.has(uid));
    for (let i = 0; i < missing.length; i += 30) {
        const chunk = missing.slice(i, i + 30);
        try {
            const snap = await getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk), limit(30)));
            const found = new Set();
            snap.docs.forEach((d) => {
                found.add(d.id);
                nameCache.set(d.id, d.data().username || d.data().displayName || null);
            });
            chunk.filter((uid) => !found.has(uid)).forEach((uid) => nameCache.set(uid, null));
        } catch {
            // names are cosmetic - fall back to the name saved with the duel
        }
    }
    return Object.fromEntries(wanted.filter((uid) => nameCache.get(uid)).map((uid) => [uid, nameCache.get(uid)]));
}

// Username prefix search for the opponent picker: one small indexed query (range on the single
// field usernameLower, so no composite index) that only runs when the player types, instead of
// loading the whole directory up front. Returns at most `max` { uid, displayName, photoURL }.
export async function searchUsersByUsername(prefix, max = 10) {
    const q = prefix.trim().toLowerCase();
    if (q.length < 2) return [];
    const snapshot = await getDocs(
        query(
            collection(db, 'users'),
            orderBy('usernameLower'),
            where('usernameLower', '>=', q),
            where('usernameLower', '<=', q + ''),
            limit(max)
        )
    );
    return snapshot.docs.map((d) => {
        const data = d.data();
        return { uid: d.id, displayName: data.username || data.displayName, photoURL: data.photoURL || null };
    });
}
