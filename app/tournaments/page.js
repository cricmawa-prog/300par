'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { useUser } from '../../lib/auth/AuthProvider';
import { STATUS_LABEL, subscribeToMyInvites, subscribeToMyTournaments } from '../../lib/tournament/client';
import { tournamentAction } from '../../lib/api/client';
import { friendlyError } from '../../lib/firebaseErrors';
import Spinner from '../../components/Duel/Spinner';

function InviteCard({ invite }) {
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState(null);
    async function respond(accept) {
        setBusy(accept ? 'accept' : 'decline');
        setError(null);
        try {
            await tournamentAction(invite.tournamentId, 'respond', { accept });
        } catch (err) {
            setError(err.message);
            setBusy(null);
        }
    }
    return (
        <div className="bg-surface border border-accent/50 rounded-xl p-4 flex flex-col gap-3">
            <div>
                <p className="font-display text-text">{invite.tournamentName}</p>
                <p className="text-xs text-textMuted">{invite.hostName} invited you · round robin, then playoffs</p>
            </div>
            <div className="flex gap-2">
                <button onClick={() => respond(true)} disabled={!!busy} className="flex-1 py-2 rounded-lg bg-accent hover:bg-accentHover text-white text-sm font-semibold disabled:opacity-60">
                    {busy === 'accept' ? 'Joining…' : 'Accept'}
                </button>
                <button onClick={() => respond(false)} disabled={!!busy} className="flex-1 py-2 rounded-lg border border-border text-text text-sm disabled:opacity-60">
                    {busy === 'decline' ? '…' : 'Decline'}
                </button>
            </div>
            {error && <p className="text-xs text-loss">{error}</p>}
        </div>
    );
}

export default function TournamentsPage() {
    const { user } = useUser();
    const uid = user?.id;
    const [invites, setInvites] = useState([]);
    const [tournaments, setTournaments] = useState(undefined);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!uid) return undefined;
        const onErr = (err) => setError(friendlyError(err));
        const a = subscribeToMyInvites(uid, setInvites, onErr);
        const b = subscribeToMyTournaments(uid, setTournaments, onErr);
        return () => {
            a();
            b();
        };
    }, [uid]);

    const mine = (tournaments || []).filter((t) => t.players?.[uid]);

    return (
        <div className="max-w-2xl mx-auto p-4 sm:p-6 md:p-10 flex flex-col gap-6">
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-2xl sm:text-3xl font-display text-text uppercase tracking-wide">Tournaments</h1>
                <Link href="/tournaments/new" className="px-4 py-2 rounded-lg bg-accent hover:bg-accentHover text-white text-sm font-semibold">
                    + New
                </Link>
            </div>

            {invites.length > 0 && (
                <section className="flex flex-col gap-3">
                    <h2 className="text-xs uppercase tracking-widest text-textMuted">Invites</h2>
                    {invites.map((i) => (
                        <InviteCard key={i.id} invite={i} />
                    ))}
                </section>
            )}

            <section className="flex flex-col gap-3">
                <h2 className="text-xs uppercase tracking-widest text-textMuted">Your tournaments</h2>
                {tournaments === undefined && !error && <Spinner label="Loading…" className="text-sm text-textMuted" />}
                {error && <p className="text-sm text-loss">{error}</p>}
                {tournaments && mine.length === 0 && (
                    <p className="text-sm text-textMuted bg-surface border border-border rounded-xl p-6 text-center">
                        No tournaments yet. Start one and invite 3-9 friends.
                    </p>
                )}
                {mine.map((t) => (
                    <Link key={t.id} href={`/tournaments/${t.id}`} className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between gap-3 hover:border-accent transition-colors">
                        <div className="min-w-0">
                            <p className="font-display text-text truncate">{t.name}</p>
                            <p className="text-xs text-textMuted">
                                {Object.keys(t.players || {}).length} players · hosted by {t.hostUid === uid ? 'you' : t.hostName}
                            </p>
                        </div>
                        <span className="shrink-0 flex items-center gap-1.5 text-xs text-textMuted">
                            {t.status === 'complete' && <Trophy size={14} className="text-accent" />}
                            {t.status === 'complete' && t.championUid ? `${t.players?.[t.championUid]?.name} won` : STATUS_LABEL[t.status]}
                        </span>
                    </Link>
                ))}
            </section>
        </div>
    );
}
