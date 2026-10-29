const HISTORY_KEY = 'srh300par:history';
const MAX_HISTORY = 20;

export function getHistory() {
    if (typeof window === 'undefined') return [];
    try {
        return JSON.parse(window.localStorage.getItem(HISTORY_KEY)) || [];
    } catch {
        return [];
    }
}

export function saveResult({ score, wickets, won, xi }) {
    if (typeof window === 'undefined') return;
    const history = getHistory();
    history.unshift({
        score,
        wickets,
        won,
        xi,
        timestamp: Date.now(),
    });
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

export function getBestScore() {
    const history = getHistory();
    if (!history.length) return null;
    return history.reduce((best, run) => (run.score > best ? run.score : best), 0);
}
