// A 300+ scored while signed out is parked here until the player signs in, then saved by
// components/Game/PendingScoreSaver.js - so signing up mid-game never costs them the score.
const KEY = 'srh300par:pendingScore';
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export function setPendingScore(entry) {
    try {
        window.localStorage.setItem(KEY, JSON.stringify({ ...entry, savedAt: Date.now() }));
    } catch {}
}

export function takePendingScore() {
    try {
        const raw = window.localStorage.getItem(KEY);
        if (!raw) return null;
        window.localStorage.removeItem(KEY);
        const entry = JSON.parse(raw);
        return Date.now() - entry.savedAt <= MAX_AGE_MS ? entry : null;
    } catch {
        return null;
    }
}

export function hasPendingScore() {
    try {
        return !!window.localStorage.getItem(KEY);
    } catch {
        return false;
    }
}
