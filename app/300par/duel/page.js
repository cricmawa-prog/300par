'use client';

import { useState } from 'react';
import { displayNameFromUser } from '../../../lib/userName';
import Spinner from '../../../components/Duel/Spinner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SignedIn, SignedOut, useUser } from '../../../lib/auth/AuthProvider';
import OpponentList from '../../../components/Duel/OpponentList';
import TeamPicker from '../../../components/Duel/TeamPicker';
import GroundPicker from '../../../components/Duel/GroundPicker';
import { groundsEnabled } from '../../../lib/game/grounds';
import { createRoom } from '../../../lib/duel/room';
import { getTeams } from '../../../lib/data/seasonSquads';
import { friendlyError } from '../../../lib/firebaseErrors';

export default function DuelLobby() {
    const { user } = useUser();
    const router = useRouter();
    const teams = getTeams();
    const [team, setTeam] = useState(null); // no default - the player must pick one
    const [ground, setGround] = useState(null); // optional (beta); null = standard duel logic
    const stadiums = groundsEnabled();
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState(null);

    async function handleChallenge(opponent) {
        if (!user || creating || !team) return;
        setCreating(true);
        setError(null);
        try {
            const roomId = await createRoom({
                hostUid: user.id,
                hostName: displayNameFromUser(user),
                hostTeam: team,
                opponentUid: opponent.uid,
                opponentName: opponent.displayName,
                ground: stadiums ? ground : null,
            });
            window.dispatchEvent(new Event('srh:navigate'));
            router.push(`/300par/duel/${roomId}`);
        } catch (err) {
            setError(friendlyError(err));
            setCreating(false);
        }
    }

    return (
        <div className="max-w-2xl mx-auto p-4 sm:p-6 md:p-10 bg-bg min-h-screen">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-display text-text text-center uppercase tracking-wide mb-2">
                1v1 Duel
            </h1>
            <p className="text-center text-textMuted text-sm sm:text-base mb-6 max-w-xl mx-auto">
                Pick a franchise and an opponent, draft against each other turn by turn, then compare chases.
                Sign in required so results can be saved to your dashboard.
            </p>

            <SignedOut>
                <div className="flex flex-col items-center gap-4 bg-surface border border-border rounded-xl p-6 sm:p-10">
                    <p className="text-text text-center">Sign in to challenge another player.</p>
                    <Link
                        href="/signin"
                        className="py-2 px-6 rounded-lg text-white bg-accent hover:bg-accentHover transition-colors font-semibold"
                    >
                        Sign In
                    </Link>
                </div>
            </SignedOut>

            <SignedIn>
                <div className="bg-surface border border-border rounded-xl p-4 sm:p-6 flex flex-col gap-4">
                    <TeamPicker teams={teams} value={team} onChange={setTeam} />
                    {stadiums && <GroundPicker value={ground} onChange={setGround} />}

                    <h2 className="font-display text-text uppercase tracking-wide text-sm">Choose an opponent</h2>
                    {!team && <p className="text-xs text-textMuted -mt-2">Pick your franchise above to challenge someone.</p>}
                    {user && <OpponentList currentUid={user.id} onChallenge={handleChallenge} disabled={!team || creating} />}
                    {creating && <Spinner label="Creating room…" className="text-xs text-textMuted justify-center w-full" />}
                    {error && <p className="text-xs text-loss text-center">{error}</p>}
                </div>
            </SignedIn>
        </div>
    );
}
