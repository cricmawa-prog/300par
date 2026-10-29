// One rule for how a player is named across the duel feature (opponent search, rooms, results,
// dashboard): the Clerk username they chose, else their full name, else the part of their email
// before the "@" (never the whole address).
export function pickDisplayName({ username, firstName, lastName, email }) {
    const full = [firstName, lastName].filter(Boolean).join(' ');
    return username || full || (email ? email.split('@')[0] : '') || 'Player';
}

// Client side: the user object from lib/auth/AuthProvider useUser().
export function displayNameFromUser(user) {
    return pickDisplayName({
        username: user?.username,
        firstName: user?.firstName,
        lastName: user?.lastName,
        email: user?.primaryEmailAddress?.emailAddress,
    });
}
