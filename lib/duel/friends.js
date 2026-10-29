// "Pinned friends" for the 1v1 opponent picker, kept in this browser's localStorage so the picker
// opens instantly with zero Firestore reads. Each entry stores a name/photo snapshot, refreshed
// whenever that player shows up in a search. (Not synced across devices.)
const KEY = 'srh300par:friends';

export function getFriends() {
    try {
        const list = JSON.parse(window.localStorage.getItem(KEY));
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}

function save(list) {
    try {
        window.localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
        // storage unavailable - pins just won't persist
    }
    return list;
}

// user: { uid, displayName, photoURL }
export function addFriend(user) {
    const rest = getFriends().filter((f) => f.uid !== user.uid);
    return save([{ uid: user.uid, displayName: user.displayName, photoURL: user.photoURL || null }, ...rest]);
}

export function removeFriend(uid) {
    return save(getFriends().filter((f) => f.uid !== uid));
}

// Keep stored names/photos current for pinned players seen in fresh results.
export function refreshFriends(users) {
    const list = getFriends();
    let changed = false;
    const next = list.map((f) => {
        const fresh = users.find((u) => u.uid === f.uid);
        if (fresh && (fresh.displayName !== f.displayName || (fresh.photoURL || null) !== f.photoURL)) {
            changed = true;
            return { uid: f.uid, displayName: fresh.displayName, photoURL: fresh.photoURL || null };
        }
        return f;
    });
    return changed ? save(next) : list;
}
