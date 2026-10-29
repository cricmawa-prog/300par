'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SignedIn, SignedOut, useUser } from '../../../../lib/auth/AuthProvider';
import {
    subscribeToRoom,
    subscribeToPicks,
    joinRoom,
    chooseFirstPicker,
    submitPick,
    finalizeResult,
    markResultSeen,
    getRoomOnce,
    closeRoom,
    isRoomExpired,
    ROOM_TTL_MS,
} from '../../../../lib/duel/room';
import { getSeasonSquads, getTeams } from '../../../../lib/data/seasonSquads';
import { displayNameFromUser } from '../../../../lib/userName';
import { simulateChase, bowlingStrength } from '../../../../lib/game/simulate';
import { getGround, groundLabel, groundsEnabled } from '../../../../lib/game/grounds';
import { TOTAL_SLOTS } from '../../../../lib/game/positions';
import { TEAMS } from '../../../../data/teams';
import { friendlyError } from '../../../../lib/firebaseErrors';
import { auth } from '../../../../lib/firebase';
import { tournamentAction } from '../../../../lib/api/client';
import { saveLocalResult, loadLocalResult, pruneLocalResults } from '../../../../lib/duel/localResults';
import Spinner from '../../../../components/Duel/Spinner';
import TossPanel from '../../../../components/Duel/TossPanel';
import DuelDraftBoard from '../../../../components/Duel/DuelDraftBoard';
import DuelResult from '../../../../components/Duel/DuelResult';
import TeamPicker from '../../../../components/Duel/TeamPicker';

function buildBattingOrder(picks, uid, seasonSquads) {
    const bySlot = {};
    for (const pick of picks) {
        if (pick.uid !== uid) continue;
        const player = (seasonSquads[String(pick.year)] || []).find((p) => p.name === pick.playerName);
        if (player) bySlot[pick.slot] = player;
    }
    return Array.from({ length: TOTAL_SLOTS }, (_, i) => bySlot[i + 1]).filter(Boolean);
}

function teamName(code) {
    return TEAMS.find((t) => t.code === code)?.name || code;
}

const CLEANUP_DELAY_MS = 45 * 1000; // how long to wait before checking in for room cleanup

export default function DuelRoomPage({ params }) {
    const { roomId } = params;
    const { user, isSignedIn, isLoaded } = useUser();
    const [liveRoom, setRoom] = useState(undefined); // Firestore copy: undefined = loading, null = not found
    // A finished room is deleted from Firestore once both players have it, so the result screen
    // falls back to the copy kept in memory this visit, then to this browser's localStorage copy.
    const [finishedRoom, setFinishedRoom] = useState(null);
    const [cachedRoom, setCachedRoom] = useState(null);
    const room = liveRoom || finishedRoom || cachedRoom || liveRoom;
    const seenReported = useRef(false);
    const [picks, setPicks] = useState([]);
    const [actionError, setActionError] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [guestTeamChoice, setGuestTeamChoice] = useState(null);
    const [copied, setCopied] = useState(false);
    const [closing, setClosing] = useState(false);
    const [joining, setJoining] = useState(false);
    const simulateAttempted = useRef(false);
    // A room that briefly reads as missing (e.g. the moment a finished room is cleaned up) shouldn't
    // flash "doesn't exist" - only show that once it has stayed missing for a moment.
    const [missingConfirmed, setMissingConfirmed] = useState(false);

    // Action errors are one-off notices: let them clear themselves instead of sticking around.
    useEffect(() => {
        if (!actionError) return undefined;
        const t = setTimeout(() => setActionError(null), 8000);
        return () => clearTimeout(t);
    }, [actionError]);
    const teams = getTeams();

    // Live listeners. A listener that errors is dead, so a one-off "permission-denied" (for example
    // a request that went out a moment before the sign-in token was ready or refreshed) used to
    // leave the page stuck on an error until a manual refresh. Now it refreshes the token and
    // re-subscribes a couple of times before giving up.
    useEffect(() => {
        let cancelled = false;
        let retries = 0;
        let retryTimer;
        let unsubs = [];

        const start = () => {
            const onListenError = async (err) => {
                console.error('[duel] listener error:', err?.code, err?.message);
                if (err?.code === 'permission-denied' && retries < 3 && !cancelled) {
                    retries += 1;
                    try {
                        await auth.currentUser?.getIdToken(true);
                    } catch {
                        // fall through to the retry anyway
                    }
                    retryTimer = setTimeout(() => {
                        if (cancelled) return;
                        unsubs.forEach((u) => u());
                        start();
                    }, 700 * retries);
                    return;
                }
                if (cancelled) return;
                // Rooms are private to their two players: anyone else is simply refused.
                setLoadError(
                    err?.code === 'permission-denied'
                        ? "This duel is private - it's only open to the two players. If you were invited, sign in with the invited account."
                        : friendlyError(err)
                );
            };
            unsubs = [subscribeToRoom(roomId, setRoom, onListenError), subscribeToPicks(roomId, setPicks, onListenError)];
        };
        start();

        return () => {
            cancelled = true;
            clearTimeout(retryTimer);
            unsubs.forEach((u) => u());
        };
    }, [roomId]);

    useEffect(() => {
        pruneLocalResults();
        setCachedRoom(loadLocalResult(roomId));
    }, [roomId]);

    const myUid = user?.id;

    const looksMissing = liveRoom === null && !finishedRoom && !cachedRoom;
    useEffect(() => {
        if (!looksMissing) {
            setMissingConfirmed(false);
            return undefined;
        }
        const t = setTimeout(() => setMissingConfirmed(true), 2000);
        return () => clearTimeout(t);
    }, [looksMissing]);

    // Once this player has the finished room, keep a local copy and tell Firestore - the second
    // player to do so deletes the room (the dashboard's duelResults summary stays).
    useEffect(() => {
        if (!liveRoom || liveRoom.status !== 'complete' || !myUid) return;
        if (myUid !== liveRoom.hostUid && myUid !== liveRoom.guestUid) return;
        setFinishedRoom(liveRoom);
        saveLocalResult(liveRoom);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [liveRoom?.status, myUid]);

    // Tournament match: tell the tournament the duel is done (the server reads the result from
    // duelResults, so this is just a nudge; both players sending it is fine). If it fails, the
    // tournament page reports it on its next visit.
    const tournamentReported = useRef(false);
    useEffect(() => {
        if (!room?.tournamentId || room.status !== 'complete' || tournamentReported.current) return;
        tournamentReported.current = true;
        tournamentAction(room.tournamentId, 'report', { fixtureId: room.fixtureId }).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [room?.status, room?.tournamentId]);

    // Check in as "seen" only after a pause: the room is deleted when the second player checks in,
    // and doing that the instant the result arrives made the page flicker while the screen was
    // still switching to it. The local copy above is already saved, and if this player leaves
    // before the timer fires the room's deleteAt TTL removes it later. (Dashboard stats live in
    // duelResults, which cleanup never touches.)
    const iAmDone = !!liveRoom && liveRoom.status === 'complete' && !!myUid && (myUid === liveRoom.hostUid || myUid === liveRoom.guestUid);
    useEffect(() => {
        if (!iAmDone || seenReported.current) return undefined;
        const t = setTimeout(() => {
            seenReported.current = true;
            markResultSeen(roomId, myUid).catch(() => {
                // cleanup only - the room's deleteAt TTL removes it later if this fails
            });
        }, CLEANUP_DELAY_MS);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [iAmDone, myUid]);

    const hostSeasonSquads = room ? getSeasonSquads(room.hostTeam) : {};
    const guestSeasonSquads = room && room.guestTeam ? getSeasonSquads(room.guestTeam) : {};
    const myTeamCode = room ? (myUid === room.hostUid ? room.hostTeam : room.guestTeam) : null;
    // Before joining, a guest's page takes the colour of the franchise they've just tapped.
    const teamInfo = TEAMS.find((t) => t.code === (myTeamCode || guestTeamChoice || room?.hostTeam));
    const themeStyle = teamInfo
        ? { '--accent': teamInfo.color, '--accent-hover': teamInfo.colorHover, '--accent-muted': teamInfo.colorMuted }
        : undefined;

    useEffect(() => {
        if (!room || room.status !== 'simulating' || simulateAttempted.current) return;
        simulateAttempted.current = true;

        // Whoever won the toss and chose to draft first also bats first here - the two are the
        // same decision, not independently host-vs-guest (a real bug this fixes: it used to
        // always simulate the host's innings first regardless of who actually picked first).
        const firstUid = room.firstPickerUid;
        const isHostFirst = firstUid === room.hostUid;
        const secondUid = isHostFirst ? room.guestUid : room.hostUid;
        const firstSeasonSquads = isHostFirst ? hostSeasonSquads : guestSeasonSquads;
        const secondSeasonSquads = isHostFirst ? guestSeasonSquads : hostSeasonSquads;

        const firstOrder = buildBattingOrder(picks, firstUid, firstSeasonSquads);
        const secondOrder = buildBattingOrder(picks, secondUid, secondSeasonSquads);
        // No target for the first innings - it just sets the score the second side has to beat.
        // 'duel' scoring sits a little below solo Hard - the aim here is to win, not to reach 300.
        // Ground (beta): only when the feature switch is on and the host picked one; otherwise default logic.
        const groundKey = groundsEnabled() && getGround(room.ground) ? room.ground : null;
        const firstResult = simulateChase(firstOrder, Math.random, null, 'duel', false, bowlingStrength(secondOrder), groundKey);
        // Must beat (not just match) the first innings - target is score + 1, and the chase ends the ball it's reached.
        const secondResult = simulateChase(secondOrder, Math.random, firstResult.finalScore + 1, 'duel', true, bowlingStrength(firstOrder), groundKey);
        const winnerUid = secondResult.won ? secondUid : firstUid;

        const hostResult = isHostFirst ? firstResult : secondResult;
        const guestResult = isHostFirst ? secondResult : firstResult;

        finalizeResult(roomId, {
            hostResult,
            guestResult,
            winnerUid,
            hostUid: room.hostUid,
            guestUid: room.guestUid,
            hostTeam: room.hostTeam,
            guestTeam: room.guestTeam,
            hostName: room.hostName,
            guestName: room.guestName,
            battedFirstUid: firstUid,
            ground: groundKey,
        }).catch(async (err) => {
            console.error('[duel] finalize error:', err?.code, err?.message);
            // Both players' browsers try to finish the duel. If the other one got there first the
            // room is already complete, and a rejected second attempt is just that race - not a problem.
            try {
                const latest = await getRoomOnce(roomId);
                if (!latest || latest.status === 'complete') return;
            } catch {
                // fall through and show the original error
            }
            setActionError(friendlyError(err));
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [room?.status]);

    async function handleJoin() {
        if (!guestTeamChoice) return;
        setJoining(true);
        try {
            await joinRoom(roomId, {
                guestUid: myUid,
                guestName: displayNameFromUser(user),
                guestTeam: guestTeamChoice,
            });
        } catch (err) {
            console.error('[duel] join error:', err?.code, err?.message);
            setActionError(friendlyError(err));
        } finally {
            setJoining(false);
        }
    }

    async function handleChooseFirstPicker(uid) {
        try {
            await chooseFirstPicker(roomId, uid);
        } catch (err) {
            setActionError(friendlyError(err));
        }
    }

    async function handleSubmitPick(payload) {
        try {
            await submitPick(roomId, payload);
        } catch (err) {
            setActionError(friendlyError(err));
            throw err; // let DuelDraftBoard roll back its optimistic pick on failure
        }
    }

    async function handleCloseRoom() {
        setClosing(true);
        try {
            await closeRoom(roomId, myUid);
        } catch (err) {
            setActionError(friendlyError(err));
            setClosing(false);
        }
    }

    function handleCopyLink() {
        const link = typeof window !== 'undefined' ? window.location.href : '';
        navigator.clipboard?.writeText(link).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }

    // Ground name to show (only if the feature is on and the host picked one).
    const shownGround = groundsEnabled() ? groundLabel(room?.ground) : null;

    let body;

    // A listener error only takes over the page when there is nothing to show yet; once the room is
    // on screen it is a small inline message instead (below), so a hiccup can't wipe a live duel.
    if (loadError && !room) {
        body = <p className="text-sm text-loss text-center">{loadError}</p>;
    } else if (!isLoaded || room === undefined || (room === null && !missingConfirmed)) {
        body = <Spinner label="Loading room…" className="text-sm text-textMuted justify-center w-full" />;
    } else if (room === null) {
        body = (
            <div className="flex flex-col items-center gap-3 bg-surface border border-border rounded-xl p-6 sm:p-10 text-center">
                <p className="text-text">This room doesn't exist, or it's a finished duel whose replay has been cleared.</p>
                <p className="text-sm text-textMuted">Finished duels stay on your dashboard.</p>
                <Link href="/dashboard" className="text-accent text-sm underline">Go to dashboard</Link>
            </div>
        );
    } else if (room.status === 'closed') {
        body = (
            <div className="flex flex-col items-center gap-3 bg-surface border border-border rounded-xl p-6 sm:p-10">
                <p className="text-text text-center">This invite was closed by the host.</p>
                {room.tournamentId ? (
                    <Link href={`/tournaments/${room.tournamentId}`} className="text-accent text-sm underline">Back to the tournament</Link>
                ) : (
                    <Link href="/300par/duel" className="text-accent text-sm underline">Start a new duel</Link>
                )}
            </div>
        );
    } else if (room.status === 'waiting' && isRoomExpired(room)) {
        body = room.tournamentId ? (
            <p className="text-sm text-loss text-center">
                This match room expired before both players joined.{' '}
                <Link href={`/tournaments/${room.tournamentId}`} className="text-accent underline">Back to the tournament</Link> to open a new one.
            </p>
        ) : (
            <p className="text-sm text-loss text-center">This invite has expired (invites last {ROOM_TTL_MS / 60000} minutes).</p>
        );
    } else if (room.status === 'waiting') {
        const link = typeof window !== 'undefined' ? window.location.href : '';
        body =
            myUid === room.hostUid ? (
                <div className="flex flex-col items-center gap-4 bg-surface border border-border rounded-xl p-6 sm:p-10">
                    <p className="text-text text-center">
                        This is the link to play with <span className="text-accent font-semibold">{room.opponentName || 'your opponent'}</span>.{' '}
                        {room.tournamentId ? 'They got an email and a Join button on the tournament page - or share the link.' : 'Share it to start.'}
                        {shownGround && (<> Ground: <span className="text-accent font-semibold">{shownGround}</span>.</>)}
                    </p>
                    <div className="flex w-full max-w-md gap-2">
                        <input
                            readOnly
                            value={link}
                            onFocus={(e) => e.target.select()}
                            className="flex-1 min-w-0 bg-bg border border-border rounded-lg px-3 py-2 text-xs text-textMuted"
                        />
                        <button
                            onClick={handleCopyLink}
                            className="shrink-0 text-xs px-3 py-2 rounded-lg bg-accent hover:bg-accentHover text-white font-semibold transition-colors"
                        >
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                    <button
                        onClick={handleCloseRoom}
                        disabled={closing}
                        className="text-xs text-loss underline hover:text-loss/80 transition-colors disabled:opacity-40"
                    >
                        {closing ? 'Closing…' : 'Close this invite'}
                    </button>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-4 bg-surface border border-border rounded-xl p-6 sm:p-10">
                    <p className="text-text text-center">
                        {room.hostName} has challenged you to a 1v1 duel — {room.hostName} picked {teamName(room.hostTeam)}.
                        {shownGround && (<> The match is at <span className="text-accent font-semibold">{shownGround}</span>.</>)}
                    </p>
                    <div className="w-full">
                        <TeamPicker teams={teams} value={guestTeamChoice} onChange={setGuestTeamChoice} />
                    </div>
                    <button
                        onClick={handleJoin}
                        disabled={joining || !guestTeamChoice}
                        className="py-2 px-6 rounded-lg text-white bg-accent hover:bg-accentHover transition-colors font-semibold disabled:bg-border disabled:text-textMuted disabled:cursor-not-allowed"
                    >
                        {joining ? 'Joining…' : guestTeamChoice ? 'Join Duel' : 'Pick a franchise to join'}
                    </button>
                </div>
            );
    } else if (room.status === 'toss') {
        body = <TossPanel room={room} myUid={myUid} onChoose={handleChooseFirstPicker} />;
    } else if (room.status === 'drafting') {
        body = (
            <DuelDraftBoard
                room={room}
                myUid={myUid}
                hostSeasonSquads={hostSeasonSquads}
                guestSeasonSquads={guestSeasonSquads}
                picks={picks}
                onSubmitPick={handleSubmitPick}
            />
        );
    } else if (room.status === 'simulating') {
        body = <Spinner label="Both squads are set — Lets start the game…" className="text-sm text-textMuted justify-center w-full" />;
    } else if (room.status === 'complete') {
        body = (
            <>
                {room.tournamentId && (
                    <div className="relative z-20 flex justify-center pb-2">
                        <Link href={`/tournaments/${room.tournamentId}`} className="text-xs px-3 py-1.5 rounded-full bg-bg/80 border border-border text-text hover:border-accent">
                            ← {room.tournamentName || 'Tournament'} · points table
                        </Link>
                    </div>
                )}
                <DuelResult room={room} myUid={myUid} />
            </>
        );
    }

    return (
        <div
            className={`mx-auto bg-bg min-h-screen ${
                room?.status === 'complete' ? 'px-4 sm:px-6 md:px-10 pt-3 pb-6' : 'p-4 sm:p-6 md:p-10'
            } ${room?.status === 'drafting' ? 'max-w-3xl lg:max-w-7xl' : 'max-w-3xl'}`}
            style={themeStyle}
        >
            {room?.status !== 'complete' && (
                <h1 className="text-2xl sm:text-3xl font-display text-text text-center uppercase tracking-wide mb-2">
                    {room?.tournamentId ? `${room.tournamentName || 'Tournament'} · ${room.fixtureLabel || 'Match'}` : '1v1 Duel'}
                </h1>
            )}
            {room && room.hostName && room.guestName && room.status !== 'complete' && (
                <p className="text-sm text-textMuted text-center mb-6">
                    {room.hostName}'s {room.hostTeam} vs {room.guestName}'s {room.guestTeam}
                    {shownGround && <> · {shownGround}</>}
                </p>
            )}

            <SignedOut>
                <div className="flex flex-col items-center gap-4 bg-surface border border-border rounded-xl p-6 sm:p-10">
                    <p className="text-text text-center">Sign in to join this duel.</p>
                    <Link
                        href={`/signin?redirect_url=/300par/duel/${roomId}`}
                        className="py-2 px-6 rounded-lg text-white bg-accent hover:bg-accentHover transition-colors font-semibold"
                    >
                        Sign In
                    </Link>
                </div>
            </SignedOut>

            <SignedIn>
                {body}
                {actionError && <p className="relative z-10 text-xs text-loss text-center mt-3">{actionError}</p>}
                {loadError && room && <p className="relative z-10 text-xs text-loss text-center mt-3">{loadError}</p>}
            </SignedIn>
        </div>
    );
}
