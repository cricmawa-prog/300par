'use client';

import { useEffect, useRef, useState } from 'react';
import { useUser } from '../../lib/auth/AuthProvider';
import { submitScore } from '../../lib/data/leaderboard';
import { takePendingScore, hasPendingScore } from '../../lib/game/pendingScore';
import { displayNameFromUser } from '../../lib/userName';

// Mounted once in the root layout: when someone signs in with a 300+ parked from before they
// had an account, save it and say so briefly. Does nothing (no reads, no writes) otherwise.
export default function PendingScoreSaver() {
    const { isLoaded, isSignedIn, user } = useUser();
    const [toast, setToast] = useState(null);
    const ran = useRef(false);

    useEffect(() => {
        if (!isLoaded || !isSignedIn || ran.current || !hasPendingScore()) return;
        ran.current = true;
        const entry = takePendingScore();
        if (!entry) return;
        submitScore({ ...entry, uid: user.id, name: displayNameFromUser(user) })
            .then((ok) => ok && setToast(`Your ${entry.score} was saved to the 300 Par leaderboard.`))
            .catch(() => {});
    }, [isLoaded, isSignedIn, user]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 6000);
        return () => clearTimeout(t);
    }, [toast]);

    if (!toast) return null;
    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] rounded-xl border border-accent bg-surface px-4 py-3 text-sm text-text shadow-2xl">
            {toast}
        </div>
    );
}
