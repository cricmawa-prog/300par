'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useUser } from '../../lib/auth/AuthProvider';
import { PAR, dateKey, submitScore } from '../../lib/data/leaderboard';
import { setPendingScore } from '../../lib/game/pendingScore';
import { displayNameFromUser } from '../../lib/userName';
import { friendlyError } from '../../lib/firebaseErrors';

// Shown under a solo result that reached 300. Signed in: saves to the leaderboard automatically.
// Signed out: offers sign-up and parks the score so it is saved right after they sign in.
// entry: { score, wickets, balls, team, difficulty }
export default function LeaderboardSave({ entry }) {
    const { isLoaded, isSignedIn, user } = useUser();
    const [status, setStatus] = useState('idle'); // idle | saving | saved | error
    const [error, setError] = useState(null);
    const started = useRef(false);
    const dayRef = useRef(dateKey());

    useEffect(() => {
        if (!isLoaded || !isSignedIn || started.current || entry.score < PAR) return;
        started.current = true;
        setStatus('saving');
        submitScore({ ...entry, uid: user.id, name: displayNameFromUser(user), dateKey: dayRef.current })
            .then(() => setStatus('saved'))
            .catch((err) => {
                setError(friendlyError(err));
                setStatus('error');
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoaded, isSignedIn]);

    if (entry.score < PAR || !isLoaded) return null;

    return (
        <div className="rounded-xl border border-accent/40 bg-accentMuted px-4 py-3 text-sm text-text flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            {isSignedIn ? (
                <>
                    <p>
                        {status === 'saving' && 'Saving your 300+ to the leaderboard…'}
                        {status === 'saved' && `Saved — ${entry.score} is on the leaderboard.`}
                        {status === 'error' && <span className="text-loss">Couldn't save to the leaderboard: {error}</span>}
                    </p>
                    <Link href="/300par/leaderboard" className="text-accent font-semibold underline shrink-0">View leaderboard</Link>
                </>
            ) : (
                <>
                    <p>You scored {entry.score}! Sign in to put it on the leaderboard — your score is kept until you do.</p>
                    <Link
                        href="/signup"
                        onClick={() => setPendingScore({ ...entry, dateKey: dayRef.current })}
                        className="shrink-0 text-center px-4 py-2 rounded-lg bg-accent hover:bg-accentHover text-white font-semibold transition-colors"
                    >
                        Sign in to save
                    </Link>
                </>
            )}
        </div>
    );
}
