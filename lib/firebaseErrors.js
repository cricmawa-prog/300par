// Maps raw Firestore errors to messages a player can act on. Our own thrown errors (turn
// order, expired invite, etc.) have no `code` and pass through unchanged.
export function isQuotaError(err) {
    return err?.code === 'resource-exhausted';
}

export function friendlyError(err) {
    switch (err?.code) {
        case 'resource-exhausted':
            return "Our free daily database limit has been reached, so duels are paused until it resets (daily, around 1 PM IST). Solo 300 Par still works.";
        case 'unavailable':
        case 'deadline-exceeded':
            return 'Connection problem reaching the server. Check your internet and try again.';
        case 'permission-denied':
            return 'The server rejected this request. Please refresh and try again.';
        default:
            return err?.message || 'Something went wrong. Please try again.';
    }
}
