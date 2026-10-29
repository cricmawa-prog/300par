'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import Spinner from './Spinner';
import { searchUsersByUsername } from '../../lib/data/users';
import { addFriend, getFriends, refreshFriends, removeFriend } from '../../lib/duel/friends';
import { friendlyError } from '../../lib/firebaseErrors';

const DEBOUNCE_MS = 350;
const MIN_CHARS = 2;

function useDebouncedValue(value, delayMs) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(t);
    }, [value, delayMs]);
    return debounced;
}

function Row({ user, pinned, onTogglePin, onChallenge, disabled }) {
    return (
        <div className="flex items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-accentMuted text-accent font-display flex items-center justify-center text-xs shrink-0 overflow-hidden">
                    {user.photoURL ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                        (user.displayName || '?').slice(0, 2).toUpperCase()
                    )}
                </div>
                <span className="text-text truncate">{user.displayName}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <button
                    onClick={() => onTogglePin(user)}
                    aria-label={pinned ? `Remove ${user.displayName} from friends` : `Pin ${user.displayName} as a friend`}
                    title={pinned ? 'Remove from friends' : 'Pin as friend'}
                    className="p-1.5 rounded-lg text-textMuted hover:text-accent transition-colors"
                >
                    <Star size={18} className={pinned ? 'fill-accent text-accent' : ''} />
                </button>
                <button
                    onClick={() => onChallenge(user)}
                    disabled={disabled}
                    className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accentHover transition-colors font-semibold disabled:bg-border disabled:text-textMuted disabled:cursor-not-allowed"
                >
                    Challenge
                </button>
            </div>
        </div>
    );
}

// Opponent picker. Opens on your pinned friends (local, instant, no reads); finding anyone new is
// a username search that only queries Firestore after you type 2+ characters.
export default function OpponentList({ currentUid, onChallenge, disabled = false }) {
    const [friends, setFriends] = useState([]);
    const [query, setQuery] = useState('');
    const debounced = useDebouncedValue(query, DEBOUNCE_MS);
    const [results, setResults] = useState(null); // null = not searching
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        setFriends(getFriends());
    }, []);

    useEffect(() => {
        const q = debounced.trim();
        if (q.length < MIN_CHARS) {
            setResults(null);
            setSearching(false);
            return undefined;
        }
        let cancelled = false;
        setSearching(true);
        setError(null);
        searchUsersByUsername(q)
            .then((users) => {
                if (cancelled) return;
                const others = users.filter((u) => u.uid !== currentUid);
                setResults(others);
                setFriends(refreshFriends(others));
                setSearching(false);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(friendlyError(err));
                setSearching(false);
            });
        return () => {
            cancelled = true;
        };
    }, [debounced, currentUid]);

    const isPinned = (uid) => friends.some((f) => f.uid === uid);
    const togglePin = (user) => setFriends(isPinned(user.uid) ? removeFriend(user.uid) : addFriend(user));

    const typing = query.trim().length >= MIN_CHARS;

    return (
        <div className="flex flex-col gap-4">
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a player by username…"
                className="bg-surface border border-border rounded-lg px-4 py-2 text-text placeholder:text-textMuted focus:outline-none focus:border-accent"
            />

            {error && <p className="text-sm text-loss text-center">Couldn&apos;t search: {error}</p>}

            {typing ? (
                <>
                    {(searching || results === null) && !error && (
                        <div className="py-4 flex justify-center">
                            <Spinner label="Searching…" className="text-sm text-textMuted" />
                        </div>
                    )}
                    {!searching && results && results.length === 0 && (
                        <p className="text-sm text-textMuted text-center py-4">No players found starting with “{query.trim()}”.</p>
                    )}
                    {!searching && results && results.length > 0 && (
                        <div className="flex flex-col divide-y divide-border">
                            {results.map((user) => (
                                <Row key={user.uid} user={user} pinned={isPinned(user.uid)} onTogglePin={togglePin} onChallenge={onChallenge} disabled={disabled} />
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <>
                    <p className="text-xs text-textMuted uppercase tracking-widest">Your friends</p>
                    {friends.length === 0 ? (
                        <p className="text-sm text-textMuted text-center py-4">
                            No friends pinned yet. Search a username above, then tap the ★ to pin them here for next time.
                        </p>
                    ) : (
                        <div className="flex flex-col divide-y divide-border">
                            {friends
                                .filter((f) => f.uid !== currentUid)
                                .map((user) => (
                                    <Row key={user.uid} user={user} pinned onTogglePin={togglePin} onChallenge={onChallenge} disabled={disabled} />
                                ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
