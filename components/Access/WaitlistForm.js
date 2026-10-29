'use client';

import { useState } from 'react';
import { api } from '../../lib/api/client';

const MESSAGES = {
    pending: "You're on the waitlist. We'll email you as soon as an admin lets you in.",
    approved: "You're approved! Sign in with this email to start playing.",
    rejected: "This request wasn't approved for the beta.",
};

// Join-the-beta form. Signed out: name + email. Signed in (`signedInEmail` given): the account's
// own email is used by the server, so only the name is asked for.
export default function WaitlistForm({ signedInEmail = null, defaultName = '', onDone }) {
    const [name, setName] = useState(defaultName);
    const [email, setEmail] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState(null);
    const [error, setError] = useState(null);

    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            const out = await api('/api/waitlist', { body: { name, email: signedInEmail || email, note }, signedOut: !signedInEmail });
            setStatus(out.status);
            onDone?.(out.status);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    if (status) {
        return <p className={`text-sm text-center ${status === 'rejected' ? 'text-loss' : 'text-win'}`}>{MESSAGES[status]}</p>;
    }

    const input = 'w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-textMuted focus:outline-none focus:border-accent';
    return (
        <form onSubmit={submit} className="flex flex-col gap-3 w-full">
            <input className={input} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={40} />
            {signedInEmail ? (
                <p className="text-xs text-textMuted">Requesting access for <span className="text-text">{signedInEmail}</span></p>
            ) : (
                <input className={input} type="email" placeholder="Email (the one you'll sign in with)" value={email} onChange={(e) => setEmail(e.target.value)} required />
            )}
            <textarea className={`${input} resize-none`} rows={2} maxLength={280} placeholder="Who invited you? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <button
                disabled={busy}
                className="py-2.5 rounded-lg bg-accent hover:bg-accentHover text-white font-semibold transition-colors disabled:opacity-60"
            >
                {busy ? 'Sending…' : 'Join the waitlist'}
            </button>
            {error && <p className="text-xs text-loss text-center">{error}</p>}
        </form>
    );
}
