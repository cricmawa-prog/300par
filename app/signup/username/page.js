'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../../../lib/auth/AuthProvider';
import { claimUsername, friendlyAuthError, validateUsername } from '../../../lib/auth/actions';
import { Field, SubmitButton, useRedirectTarget } from '../../../components/Auth/AuthParts';

// First-time step for anyone who signed in (typically with Google) but has no username yet.
// Deliberately has no "Sign in" prompt - they are mid-sign-up.
function UsernameForm() {
    const router = useRouter();
    const redirectTo = useRedirectTarget();
    const { isLoaded, isSignedIn, user, profile } = useUser();
    const [username, setUsername] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    // Suggest the name typed at sign-up (kept on the auth account while the beta approval was
    // pending), else something from the email, once.
    useEffect(() => {
        const email = user?.primaryEmailAddress?.emailAddress;
        const typed = user?.fullName && !user.fullName.includes(' ') ? user.fullName : null;
        const guess = typed || (email ? email.split('@')[0] : '');
        if (guess && !username) setUsername(guess.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 30));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    useEffect(() => {
        if (!isLoaded) return;
        if (!isSignedIn) router.replace('/signin');
        else if (profile?.username) router.replace(redirectTo);
    }, [isLoaded, isSignedIn, profile?.username, redirectTo, router]);

    async function submit(e) {
        e.preventDefault();
        const problem = validateUsername(username);
        if (problem) return setError(problem);
        setBusy(true);
        setError(null);
        try {
            await claimUsername(user.id, username, { photoURL: user.imageUrl });
            router.replace(redirectTo);
        } catch (err) {
            setError(friendlyAuthError(err));
            setBusy(false);
        }
    }

    return (
        <form onSubmit={submit} className="w-full max-w-md flex flex-col gap-4">
            <div className="text-center">
                <h1 className="text-2xl md:text-3xl font-display text-text">Almost there</h1>
                <p className="text-textMuted mt-2">Pick a username. Other players see it in duels and on the leaderboard.</p>
            </div>
            <Field label="Username" value={username} onChange={setUsername} autoComplete="username" hint="3-30 characters: letters, numbers, _ . -" />
            {error && <p className="text-sm text-loss">{error}</p>}
            <SubmitButton busy={busy}>Continue</SubmitButton>
        </form>
    );
}

export default function UsernamePage() {
    return (
        <div className="pt-8 flex min-h-screen items-center justify-center bg-bg px-4">
            <div className="w-full max-w-lg bg-surface border border-border shadow-2xl rounded-xl p-6 md:p-10 flex justify-center">
                <Suspense fallback={null}>
                    <UsernameForm />
                </Suspense>
            </div>
        </div>
    );
}
