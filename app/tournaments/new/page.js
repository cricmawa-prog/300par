'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '../../../lib/auth/AuthProvider';
import { api } from '../../../lib/api/client';
import { MAX_PLAYERS, MIN_PLAYERS } from '../../../lib/tournament/format';
import PlayerPicker from '../../../components/Tournament/PlayerPicker';

export default function NewTournamentPage() {
    const { user } = useUser();
    const router = useRouter();
    const [name, setName] = useState('');
    const [selected, setSelected] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const total = selected.length + 1;
    const enough = total >= MIN_PLAYERS;

    async function create(e) {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            const out = await api('/api/tournaments', { body: { name, inviteeUids: selected.map((s) => s.uid) } });
            window.dispatchEvent(new Event('srh:navigate'));
            router.push(`/tournaments/${out.id}${out.emailsFailed?.length ? '?mailfail=1' : ''}`);
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    }

    return (
        <form onSubmit={create} className="max-w-2xl mx-auto p-4 sm:p-6 md:p-10 flex flex-col gap-5">
            <h1 className="text-2xl sm:text-3xl font-display text-text uppercase tracking-wide">New tournament</h1>

            <label className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-widest text-textMuted">Name</span>
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={3}
                    maxLength={40}
                    placeholder="Sunday Smash"
                    className="bg-bg border border-border rounded-lg px-4 py-2 text-text placeholder:text-textMuted focus:outline-none focus:border-accent"
                />
            </label>

            <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-widest text-textMuted">Invite players</span>
                    <span className={`text-xs tabular-nums ${enough ? 'text-win' : 'text-textMuted'}`}>
                        {total} / {MAX_PLAYERS} incl. you
                    </span>
                </div>
                {user && <PlayerPicker currentUid={user.id} selected={selected} onChange={setSelected} max={MAX_PLAYERS - 1} />}
            </div>

            <ul className="text-xs text-textMuted list-disc pl-5 flex flex-col gap-1">
                <li>Everyone you pick gets an email and an in-app invite to accept or decline (invites last 3 days).</li>
                <li>It starts by itself once everyone has answered, or press Start any time {MIN_PLAYERS}+ players are in - nobody waits on a no-show.</li>
                <li>Round robin: everyone plays everyone once as a 1v1 duel, in any order. Win = 2 points, ties on points go to net run rate.</li>
                <li>4 players: top 3 qualify (2nd v 3rd semi, winner meets 1st in the final). 5+: top 4, 1st v 4th and 2nd v 3rd semis, then the final.</li>
            </ul>

            <button
                disabled={busy || !enough || name.trim().length < 3}
                className="py-3 rounded-lg bg-accent hover:bg-accentHover text-white font-semibold transition-colors disabled:bg-border disabled:text-textMuted"
            >
                {busy ? 'Creating…' : enough ? `Create & send ${selected.length} invites` : `Pick at least ${MIN_PLAYERS - 1} players`}
            </button>
            {error && <p className="text-sm text-loss text-center">{error}</p>}
        </form>
    );
}
