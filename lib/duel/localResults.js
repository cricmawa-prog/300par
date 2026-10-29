// Browser-side copy of a finished duel (both innings, ball by ball) so the result screen and
// its replay keep working after the room is deleted from Firestore. Each entry is ~30 KB; old
// ones are pruned (expiry + a small cap) so localStorage never grows enough to slow the page.
// Every access is wrapped - private mode / blocked storage just means no local copy.

const PREFIX = 'duelRoom:';
const WATCHED_PREFIX = 'duelWatched:';
export const LOCAL_RESULT_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 10;

// Only what the result screen needs - no Firestore Timestamps, which don't survive JSON.
const KEEP = ['id', 'status', 'hostUid', 'guestUid', 'hostName', 'guestName', 'hostTeam', 'guestTeam', 'firstPickerUid', 'resultHost', 'resultGuest', 'winnerUid', 'tournamentId', 'tournamentName', 'fixtureId', 'fixtureLabel'];

export function saveLocalResult(room) {
    try {
        const slim = Object.fromEntries(KEEP.map((k) => [k, room[k] ?? null]));
        localStorage.setItem(PREFIX + room.id, JSON.stringify({ savedAt: Date.now(), room: slim }));
        pruneLocalResults();
    } catch {
        // storage unavailable or full - the in-memory copy still covers this visit
    }
}

export function loadLocalResult(roomId) {
    try {
        const raw = localStorage.getItem(PREFIX + roomId);
        if (!raw) return null;
        const entry = JSON.parse(raw);
        if (Date.now() - entry.savedAt > LOCAL_RESULT_TTL_MS) {
            removeEntry(roomId);
            return null;
        }
        return entry.room;
    } catch {
        return null;
    }
}

function removeEntry(roomId) {
    localStorage.removeItem(PREFIX + roomId);
    localStorage.removeItem(WATCHED_PREFIX + roomId);
}

// Drops expired entries, then the oldest beyond MAX_ENTRIES.
export function pruneLocalResults() {
    try {
        const entries = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(PREFIX)) continue;
            let savedAt = 0;
            try {
                savedAt = JSON.parse(localStorage.getItem(key)).savedAt || 0;
            } catch {
                // unreadable entry - treat as oldest so it goes first
            }
            entries.push({ roomId: key.slice(PREFIX.length), savedAt });
        }
        entries.sort((a, b) => b.savedAt - a.savedAt);
        entries.forEach((e, i) => {
            if (i >= MAX_ENTRIES || Date.now() - e.savedAt > LOCAL_RESULT_TTL_MS) removeEntry(e.roomId);
        });
    } catch {
        // storage unavailable
    }
}
