'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api/client';
import { useUser } from '../../lib/auth/AuthProvider';
import Spinner from '../../components/Duel/Spinner';

const fmt = (ms) => (ms ? new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

// Admins only (AccessGate hides it from others; /api/admin checks ADMIN_EMAILS server side).
export default function AdminPage() {
    const { user } = useUser();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(null);
    const [notice, setNotice] = useState(null);
    const [emails, setEmails] = useState('');

    const load = useCallback(async () => {
        try {
            setData(await api('/api/admin', { method: 'GET' }));
            setError(null);
        } catch (err) {
            setError(err.message);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    async function act(key, body, confirmText) {
        if (confirmText && !window.confirm(confirmText)) return;
        setBusy(key);
        setNotice(null);
        try {
            const out = await api('/api/admin', { body });
            if (body.action === 'invite') {
                const failed = out.results.filter((r) => !r.emailSent).map((r) => r.email);
                setNotice(`Allowed ${out.results.length} email(s).${failed.length ? ` Email not sent to: ${failed.join(', ')} - tell them directly.` : ' Invite emails sent.'}`);
                setEmails('');
            } else if (body.action === 'approve' && out.emailSent === false) {
                setNotice(`Approved ${body.email}, but the email didn't send - tell them to sign in.`);
            }
            await load();
        } catch (err) {
            setNotice(err.message);
        } finally {
            setBusy(null);
        }
    }

    if (error) return <p className="text-center text-sm text-loss py-16">{error}</p>;
    if (!data) return <div className="flex justify-center py-16"><Spinner label="Loading…" className="text-sm text-textMuted" /></div>;

    return (
        <div className="max-w-3xl mx-auto p-4 sm:p-6 md:p-10 flex flex-col gap-6">
            <h1 className="text-2xl sm:text-3xl font-display text-text uppercase tracking-wide">Admin</h1>
            {notice && <p className="text-sm bg-surface border border-border rounded-lg px-3 py-2 text-text">{notice}</p>}

            <section className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
                <h2 className="font-display text-text">Invite by email</h2>
                <p className="text-xs text-textMuted">They&apos;re approved straight away and get an email. They must sign in with that exact address (Google, or a verified email + password).</p>
                <textarea
                    value={emails}
                    onChange={(e) => setEmails(e.target.value)}
                    rows={2}
                    placeholder="friend@gmail.com, another@gmail.com"
                    className="bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-textMuted focus:outline-none focus:border-accent resize-none"
                />
                <button
                    onClick={() => act('invite', { action: 'invite', emails })}
                    disabled={!emails.trim() || busy === 'invite'}
                    className="self-start px-4 py-2 rounded-lg bg-accent hover:bg-accentHover text-white text-sm font-semibold disabled:opacity-60"
                >
                    {busy === 'invite' ? 'Inviting…' : 'Invite'}
                </button>
            </section>

            <section className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
                <h2 className="font-display text-text">Waitlist ({data.waitlist.length})</h2>
                {data.waitlist.length === 0 && <p className="text-sm text-textMuted">Nobody waiting.</p>}
                <ul className="flex flex-col divide-y divide-border">
                    {data.waitlist.map((w) => (
                        <li key={w.email} className="py-3 flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-text text-sm">
                                    {w.name} <span className="text-textMuted">· {w.email}</span>
                                </p>
                                {w.note && <p className="text-xs text-textMuted">“{w.note}”</p>}
                                <p className="text-[11px] text-textMuted">{fmt(w.createdAt)}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => act(w.email, { action: 'approve', email: w.email })} disabled={!!busy} className="px-3 py-1.5 rounded-lg bg-win text-bg text-xs font-semibold disabled:opacity-60">
                                    {busy === w.email ? '…' : 'Approve'}
                                </button>
                                <button onClick={() => act(w.email, { action: 'reject', email: w.email }, `Reject ${w.email}?`)} disabled={!!busy} className="px-3 py-1.5 rounded-lg border border-loss/50 text-loss text-xs disabled:opacity-60">
                                    Reject
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
                <h2 className="font-display text-text">Members ({data.members.length})</h2>
                <ul className="flex flex-col divide-y divide-border">
                    {data.members.map((m) => (
                        <li key={m.uid} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                            <div className="min-w-0">
                                <p className="text-text truncate">
                                    {m.username || <span className="text-textMuted">no username yet</span>}
                                    {m.role === 'admin' && <span className="ml-2 text-[10px] uppercase text-accent">admin</span>}
                                </p>
                                <p className="text-xs text-textMuted truncate">{m.email} · {fmt(m.approvedAt)}</p>
                            </div>
                            {m.role !== 'admin' && m.uid !== user?.id && (
                                <button onClick={() => act(m.uid, { action: 'revoke', uid: m.uid }, `Remove ${m.username || m.email} from the beta?`)} disabled={!!busy} className="text-xs text-loss underline shrink-0">
                                    Remove
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}
