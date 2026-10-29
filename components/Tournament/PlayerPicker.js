'use client';

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import Spinner from '../Duel/Spinner';
import { searchUsersByUsername } from '../../lib/data/users';
import { getFriends } from '../../lib/duel/friends';
import { friendlyError } from '../../lib/firebaseErrors';

// Multi-select player search for tournament invites: username prefix search (same query as the
// duel opponent picker) plus your pinned duel friends as quick adds.
export default function PlayerPicker({ currentUid, selected, onChange, max, excludeUids = [] }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState(null);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState(null);
    const [friends, setFriends] = useState([]);

    useEffect(() => setFriends(getFriends()), []);

    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setResults(null);
            return undefined;
        }
        let cancelled = false;
        const t = setTimeout(() => {
            setSearching(true);
            setError(null);
            searchUsersByUsername(q)
                .then((users) => !cancelled && setResults(users))
                .catch((err) => !cancelled && setError(friendlyError(err)))
                .finally(() => !cancelled && setSearching(false));
        }, 350);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [query]);

    const taken = new Set([currentUid, ...excludeUids, ...selected.map((s) => s.uid)]);
    const full = selected.length >= max;
    const add = (u) => !full && !taken.has(u.uid) && onChange([...selected, { uid: u.uid, displayName: u.displayName }]);
    const remove = (uid) => onChange(selected.filter((s) => s.uid !== uid));
    const list = (results ?? friends).filter((u) => !taken.has(u.uid));

    return (
        <div className="flex flex-col gap-3">
            {selected.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {selected.map((s) => (
                        <span key={s.uid} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-accentMuted border border-accent/40 text-sm text-text">
                            {s.displayName}
                            <button type="button" onClick={() => remove(s.uid)} aria-label={`Remove ${s.displayName}`} className="text-textMuted hover:text-loss">
                                <X size={14} />
                            </button>
                        </span>
                    ))}
                </div>
            )}
            <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={full}
                placeholder={full ? `That's the maximum (${max})` : 'Search players by username…'}
                className="bg-bg border border-border rounded-lg px-4 py-2 text-text placeholder:text-textMuted focus:outline-none focus:border-accent disabled:opacity-60"
            />
            {error && <p className="text-xs text-loss">{error}</p>}
            {searching && <Spinner label="Searching…" className="text-xs text-textMuted" />}
            {!full && (
                <div className="flex flex-col divide-y divide-border">
                    {results === null && list.length > 0 && <p className="text-[11px] uppercase tracking-widest text-textMuted pb-2">Your pinned friends</p>}
                    {results !== null && !searching && list.length === 0 && <p className="text-sm text-textMuted py-2">No one else matches “{query.trim()}”.</p>}
                    {list.map((u) => (
                        <button type="button" key={u.uid} onClick={() => add(u)} className="flex items-center justify-between py-2.5 text-left hover:text-accent">
                            <span className="text-text truncate">{u.displayName}</span>
                            <Plus size={16} className="text-accent shrink-0" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
