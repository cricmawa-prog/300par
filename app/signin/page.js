'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useUser } from '../../lib/auth/AuthProvider';
import { friendlyAuthError, sendPasswordReset, signInWithEmail, signInWithGoogle } from '../../lib/auth/actions';
import { Divider, Field, GoogleButton, SubmitButton, useRedirectTarget } from '../../components/Auth/AuthParts';

function SignInForm() {
    const router = useRouter();
    const redirectTo = useRedirectTarget();
    const { isLoaded, isSignedIn } = useUser();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [info, setInfo] = useState(null);

    // Already signed in (or just finished signing in) -> on to where they were headed.
    useEffect(() => {
        if (isLoaded && isSignedIn) router.replace(redirectTo);
    }, [isLoaded, isSignedIn, redirectTo, router]);

    async function run(fn) {
        setBusy(true);
        setError(null);
        setInfo(null);
        try {
            await fn();
        } catch (err) {
            setError(friendlyAuthError(err));
        } finally {
            setBusy(false);
        }
    }

    function handleReset() {
        if (!email.trim() || !email.includes('@')) {
            setError('Type your email address above first, then press "Forgot password?". (Accounts made with only a username have no email to send a reset to.)');
            return;
        }
        run(async () => {
            await sendPasswordReset(email);
            setInfo('If an account exists for that email, a reset link is on its way. Check your inbox (and spam).');
        });
    }

    return (
        <div className="w-full max-w-md flex flex-col gap-4">
            <h2 className="text-2xl md:text-3xl font-display text-text text-center">Welcome Back</h2>
            <GoogleButton onClick={() => run(signInWithGoogle)} disabled={busy} />
            <Divider />
            <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                    e.preventDefault();
                    run(() => signInWithEmail(email, password));
                }}
            >
                <Field label="Email or username" value={email} onChange={setEmail} autoComplete="username" hint="Signed up with only a username? Use that." />
                <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
                <button type="button" onClick={handleReset} className="self-end text-xs text-accent hover:underline">
                    Forgot password?
                </button>
                {error && <p className="text-sm text-loss text-left">{error}</p>}
                {info && <p className="text-sm text-win text-left">{info}</p>}
                <SubmitButton busy={busy}>Sign In</SubmitButton>
            </form>
        </div>
    );
}

export default function SignInPage() {
    return (
        <motion.div
            className="flex min-h-screen items-center justify-center bg-bg px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
        >
            <motion.div
                className="flex flex-col md:flex-row-reverse w-full max-w-4xl bg-surface border border-border shadow-2xl rounded-xl overflow-hidden"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6 }}
            >
                <div className="w-full md:w-3/5 bg-surface p-6 md:p-10 flex flex-col justify-center items-center">
                    <Suspense fallback={null}>
                        <SignInForm />
                    </Suspense>
                </div>

                <div className="w-full md:w-2/5 bg-bg p-8 md:p-10 flex flex-col justify-center items-center text-center border-t md:border-t-0 md:border-l border-border">
                    <h1 className="text-2xl md:text-3xl font-display text-text">New Here?</h1>
                    <p className="text-textMuted mt-2 md:mt-4">Create an account to start your journey with us.</p>
                    <Link href="/signup" className="mt-5">
                        <motion.button
                            className="px-6 py-2 text-white bg-accent rounded-lg shadow-md hover:bg-accentHover transition duration-300"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            Sign Up
                        </motion.button>
                    </Link>
                </div>
            </motion.div>
        </motion.div>
    );
}
