import { collection, getCountFromServer, getDocs, limit, orderBy, query, startAfter, where } from 'firebase/firestore';
import { db } from '../firebase';

export const HISTORY_PAGE_SIZE = 10;

// One page of a player's finished duels, newest first. Pass the previous page's `cursor` to get
// the next one. Fetches pageSize + 1 so we know whether more exist without a second query.
export async function getDuelPage(uid, cursor = null, pageSize = HISTORY_PAGE_SIZE) {
    const constraints = [
        where('participants', 'array-contains', uid),
        orderBy('completedAt', 'desc'),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(pageSize + 1),
    ];
    const snapshot = await getDocs(query(collection(db, 'duelResults'), ...constraints));
    const docs = snapshot.docs.slice(0, pageSize);
    return {
        items: docs.map((d) => ({ id: d.id, ...d.data() })),
        cursor: docs.length ? docs[docs.length - 1] : cursor,
        hasMore: snapshot.docs.length > pageSize,
    };
}

// Lifetime totals without downloading the games: Firestore count() aggregations (billed at a
// tiny fraction of a read per document counted). Played = duels you took part in; won = duels
// you won (the winner is always a participant, so won <= played).
export async function getDuelStats(uid) {
    const col = collection(db, 'duelResults');
    const [played, won] = await Promise.all([
        getCountFromServer(query(col, where('participants', 'array-contains', uid))),
        getCountFromServer(query(col, where('winnerUid', '==', uid))),
    ]);
    return { played: played.data().count, won: won.data().count };
}
