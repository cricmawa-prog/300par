'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useUser } from '../../lib/auth/AuthProvider';
import { friendlyAuthError, signInWithGoogle, signUpWithEmail, validateUsername } from '../../lib/auth/actions';
import { Divider, Field, GoogleButton, SubmitButton, useRedirectTarget } from '../../components/Auth/AuthParts';

function SignUpForm() {
    const router = useRouter();
    const redirectTo = useRedirectTarget();
    const { isLoaded, isSignedIn, profile } = useUser();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    // Signed in with a username already -> done. (Signed in without one is sent to the username
    // screen by the profile gate, so there's nothing to do here for that case.)
    useEffect(() => {
        if (isLoaded && isSignedIn && profile?.username) router.replace(redirectTo);
    }, [isLoaded, isSignedIn, profile?.username, redirectTo, router]);

    async function run(fn) {
        setBusy(true);
        setError(null);
        try {
            await fn();
        } catch (err) {
            setError(friendlyAuthError(err));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="w-full max-w-md flex flex-col gap-4">
            <h2 className="text-2xl md:text-3xl font-display text-text text-center">Create your account</h2>
            <GoogleButton onClick={() => run(signInWithGoogle)} disabled={busy} label="Sign up with Google" />
            <Divider />
            <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                    e.preventDefault();
                    const problem = validateUsername(username);
                    if (problem) return setError(problem);
                    run(() => signUpWithEmail({ email, password, username }));
                }}
            >
                <Field
                    label="Username"
                    value={username}
                    onChange={setUsername}
                    autoComplete="username"
                    hint="This is the name other players see in duels and on the leaderboard."
                />
                <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
                <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" hint="At least 6 characters." />
                {error && <p className="text-sm text-loss text-left">{error}</p>}
                <SubmitButton busy={busy}>Create account</SubmitButton>
            </form>
        </div>
    );
}

export default function SignUpPage() {
    return (
        <motion.div
            className="pt-8 flex min-h-screen items-center justify-center bg-bg px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
        >
            <motion.div
                className="flex flex-col md:flex-row w-full max-w-4xl bg-surface border border-border shadow-2xl rounded-xl overflow-hidden"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6 }}
            >
                <div className="w-full md:w-2/5 bg-bg p-10 flex flex-col justify-center items-center text-center border-b md:border-b-0 md:border-r border-border">
                    <h1 className="text-2xl md:text-3xl font-display text-text">Welcome Back</h1>
                    <p className="text-textMuted mt-2 md:mt-4">Already have an account? Sign in to continue your journey.</p>
                    <Link href="/signin" className="mt-5">
                        <motion.button
                            className="px-6 py-2 text-white bg-accent rounded-lg shadow-md hover:bg-accentHover transition duration-300"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            Sign In
                        </motion.button>
                    </Link>
                </div>

                <div className="w-full md:w-3/5 bg-surface p-6 md:p-10 flex flex-col justify-center items-center">
                    <Suspense fallback={null}>
                        <SignUpForm />
                    </Suspense>
                </div>
            </motion.div>
        </motion.div>
    );
}
