'use client';

import { useCallback, useEffect, useState } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { api } from '../../lib/api/client';
import { signOut } from '../../lib/auth/actions';
import { useUser } from '../../lib/auth/AuthProvider';
import Spinner from '../Duel/Spinner';
import WaitlistForm from './WaitlistForm';

// Shown to a signed-in account that isn't a member yet. It first asks the server to let it in
// (admins and allow-listed emails are approved on the spot - the members/{uid} listener in
// AuthProvider then swaps this screen for the app). Otherwise: verify your email, or join /
// wait on the waitlist.
export default function AccessPending() {
    const { user } = useUser();
    const [state, setState] = useState(null); // server answer from /api/access
    const [checking, setChecking] = useState(true);
    const [error, setError] = useState(null);
    const [sent, setSent] = useState(false);

    const check = useCallback(async () => {
        setChecking(true);
        setError(null);
        try {
            await auth.currentUser?.reload(); // pick up an email verified in another tab
            await auth.currentUser?.getIdToken(true);
            setState(await api('/api/access'));
        } catch (err) {
            setError(err.message);
        } finally {
            setChecking(false);
        }
    }, []);

    useEffect(() => {
        check();
    }, [check]);

    async function resend() {
        try {
            await sendEmailVerification(auth.currentUser);
            setSent(true);
        } catch (err) {
            setError(err.code === 'auth/too-many-requests' ? 'Too many emails - wait a few minutes.' : err.message);
        }
    }

    const email = user?.primaryEmailAddress?.emailAddress;
    let body;
    if (checking && !state) {
        body = <Spinner label="Checking your access…" className="text-sm text-textMuted justify-center" />;
    } else if (state?.member) {
        body = <Spinner label="You're in - loading…" className="text-sm text-textMuted justify-center" />;
    } else if (state && !state.emailVerified) {
        body = (
            <>
                <p className="text-text">Verify your email first</p>
                <p className="text-sm text-textMuted">
                    We sent a link to <span className="text-text">{email}</span>. Open it, then come back and press the button below.
                    (Google sign-in skips this step.)
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                    <button onClick={check} className="px-4 py-2 rounded-lg bg-accent hover:bg-accentHover text-white text-sm font-semibold">
                        I&apos;ve verified
                    </button>
                    <button onClick={resend} disabled={sent} className="px-4 py-2 rounded-lg border border-border text-text text-sm disabled:opacity-50">
                        {sent ? 'Sent' : 'Resend email'}
                    </button>
                </div>
            </>
        );
    } else if (state?.waitlist === 'pending') {
        body = (
            <>
                <p className="text-text">You&apos;re on the waitlist</p>
                <p className="text-sm text-textMuted">An admin will approve <span className="text-text">{email}</span> soon - you&apos;ll get an email.</p>
                <button onClick={check} className="px-4 py-2 rounded-lg border border-border text-text text-sm">Check again</button>
            </>
        );
    } else if (state?.waitlist === 'rejected') {
        body = <p className="text-sm text-loss">This account wasn&apos;t approved for the private beta.</p>;
    } else {
        body = (
            <>
                <p className="text-text">300 Par is invite-only right now</p>
                <p className="text-sm text-textMuted">Ask to join and an admin will let you in.</p>
                <WaitlistForm signedInEmail={email} defaultName={user?.fullName || ''} onDone={() => check()} />
            </>
        );
    }

    return (
        <div className="max-w-md mx-auto px-4 py-12">
            <div className="flex flex-col items-center gap-4 bg-surface border border-border rounded-xl p-6 sm:p-8 text-center">
                {body}
                {error && <p className="text-xs text-loss">{error}</p>}
                <button onClick={() => signOut()} className="text-xs text-textMuted underline">Sign out</button>
            </div>
        </div>
    );
}
